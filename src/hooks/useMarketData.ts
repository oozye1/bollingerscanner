import { useState, useEffect, useRef } from 'react';
import { getFinnhubSymbol } from '../lib/utils';
import { calculateBollingerBands, type ScannerData, type CandleData } from '../lib/indicators';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export function useMarketData(apiKey: string, symbols: { symbol: string, type: string, display: string }[]) {
  const [data, setData] = useState<Record<string, ScannerData>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAlert, setLastAlert] = useState<{ symbol: string, type: string, time: number } | null>(null);

  // Use a ref to track if we are currently fetching to avoid race conditions or double fetches
  const isFetching = useRef(false);

  const fetchCandles = async (symbolObj: { symbol: string, type: string, display: string }) => {
    if (!apiKey) return null;
    
    const finnhubSymbol = getFinnhubSymbol(symbolObj);
    // Get daily candles for last 30 days to ensure we have enough for 20 SMA
    // Or better, 60 minute candles? Or 5 minute?
    // Scanner usually works on lower timeframes. Let's try '5' (5 minutes) or '15'.
    // Finnhub free tier supports 'D', 'W', 'M'. Intraday might be restricted or delayed.
    // Let's try 'D' first for reliability, or '60'.
    // Actually, for a "scanner" alerting on bands, intraday is better.
    // Let's try '15' (15 minutes).
    const resolution = '15'; 
    const to = Math.floor(Date.now() / 1000);
    const from = to - (24 * 60 * 60); // Last 24 hours

    try {
      const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${symbolObj.symbol}`);
      const json: CandleData = await res.json();

      if (json.s === 'ok' && json.c && json.c.length >= 20) {
        const closes = json.c;
        const currentPrice = closes[closes.length - 1];
        const bands = calculateBollingerBands(closes, 20, 2);
        
        let status: ScannerData['status'] = 'ok';
        
        if (bands) {
          const range = bands.upper - bands.lower;
          const threshold = range * 0.05; // 5% of the band width is "near"

          if (currentPrice >= bands.upper) status = 'above-upper';
          else if (currentPrice <= bands.lower) status = 'below-lower';
          else if (currentPrice >= bands.upper - threshold) status = 'near-upper';
          else if (currentPrice <= bands.lower + threshold) status = 'near-lower';
        }

        return {
          symbol: symbolObj.symbol,
          display: symbolObj.display,
          currentPrice,
          bands,
          status,
          lastUpdated: Date.now(),
          history: closes.slice(-20) // Keep last 20 for sparkline
        };
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      if (isFetching.current) return;
      isFetching.current = true;
      setLoading(true);

      const results: Record<string, ScannerData> = {};
      
      // Process sequentially to avoid rate limits (Finnhub free is ~60/min, but burst might be lower)
      // We have ~10-18 symbols.
      for (const s of symbols) {
        const res = await fetchCandles(s);
        if (res) {
          results[s.symbol] = res;
          
          // Check for alerts
          if (res.status !== 'ok') {
            setLastAlert({ symbol: s.symbol, type: res.status, time: Date.now() });
          }
        }
        // Small delay between requests
        await new Promise(r => setTimeout(r, 200));
      }

      setData(prev => ({ ...prev, ...results }));
      setLoading(false);
      isFetching.current = false;
    };

    fetchAll();

    // Poll every 60 seconds
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [apiKey, symbols]);

  return { data, loading, error, lastAlert };
}
