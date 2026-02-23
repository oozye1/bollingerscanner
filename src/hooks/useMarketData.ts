import { useState, useEffect, useRef, useCallback } from 'react';
import type { SymbolDef } from '../lib/utils';
import {
  calculateBollingerBands,
  getBandPosition,
  getProximityPct,
  type ScannerData,
} from '../lib/indicators';

const POLL_INTERVAL = 60_000;

export interface FetchLog {
  symbol: string;
  time: number;
  ok: boolean;
  message: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta: { regularMarketPrice: number; symbol: string };
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string };
  };
  error?: string;
}

function processSingleResult(
  json: YahooChartResponse,
  symbolObj: SymbolDef
): ScannerData {
  const errBase: ScannerData = {
    symbol: symbolObj.symbol,
    display: symbolObj.display,
    currentPrice: 0,
    bands: null,
    status: 'ok',
    lastUpdated: Date.now(),
    history: [],
    bandPosition: 0.5,
    proximityPct: 0,
  };

  // Server-side error
  if (json.error) {
    return { ...errBase, fetchError: json.error };
  }

  // Yahoo API error
  if (json.chart?.error) {
    return { ...errBase, fetchError: json.chart.error.description || json.chart.error.code };
  }

  const result = json.chart?.result?.[0];
  if (!result?.indicators?.quote?.[0]?.close) {
    return { ...errBase, fetchError: 'No chart data' };
  }

  const closes: number[] = result.indicators.quote[0].close.filter(
    (c): c is number => c !== null && c !== undefined && !isNaN(c)
  );

  if (closes.length < 20) {
    return {
      ...errBase,
      currentPrice: closes[closes.length - 1] ?? result.meta.regularMarketPrice ?? 0,
      history: closes.slice(-20),
      fetchError: `Only ${closes.length} candles (need 20)`,
    };
  }

  const currentPrice = closes[closes.length - 1];
  const bands = calculateBollingerBands(closes, 20, 2);

  let status: ScannerData['status'] = 'ok';
  let bandPosition = 0.5;
  let proximityPct = 0;

  if (bands) {
    const range = bands.upper - bands.lower;
    const threshold = range * 0.05;

    if (currentPrice >= bands.upper) status = 'above-upper';
    else if (currentPrice <= bands.lower) status = 'below-lower';
    else if (currentPrice >= bands.upper - threshold) status = 'near-upper';
    else if (currentPrice <= bands.lower + threshold) status = 'near-lower';

    bandPosition = getBandPosition(currentPrice, bands);
    proximityPct = getProximityPct(currentPrice, bands);
  }

  return {
    symbol: symbolObj.symbol,
    display: symbolObj.display,
    currentPrice,
    bands,
    status,
    lastUpdated: Date.now(),
    history: closes.slice(-30),
    bandPosition,
    proximityPct,
  };
}

export function useMarketData(symbols: SymbolDef[]) {
  const [data, setData] = useState<Record<string, ScannerData>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [lastAlert, setLastAlert] = useState<{
    symbol: string;
    type: string;
    time: number;
  } | null>(null);
  const [fetchLogs, setFetchLogs] = useState<FetchLog[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const [nextFetchTime, setNextFetchTime] = useState<number | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);

  const isFetching = useRef(false);

  const addLog = useCallback(
    (symbol: string, ok: boolean, message: string) => {
      setFetchLogs((prev) => [
        { symbol, time: Date.now(), ok, message },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  useEffect(() => {
    const fetchAll = async () => {
      if (isFetching.current) return;
      isFetching.current = true;
      setLoading(true);

      const results: Record<string, ScannerData> = {};
      let ok = 0;
      let fail = 0;

      // Use the server-side batch endpoint (handles rate limiting + caching)
      const yahooSymbols = symbols.map((s) => s.yahoo).join(',');

      try {
        const res = await fetch(`/api/charts?symbols=${encodeURIComponent(yahooSymbols)}`);

        if (!res.ok) {
          const errText = `Server error: ${res.status}`;
          for (const s of symbols) {
            addLog(s.symbol, false, errText);
            results[s.symbol] = {
              symbol: s.symbol,
              display: s.display,
              currentPrice: 0,
              bands: null,
              status: 'ok',
              lastUpdated: Date.now(),
              history: [],
              bandPosition: 0.5,
              proximityPct: 0,
              fetchError: errText,
            };
            fail++;
          }
        } else {
          const batchData: Record<string, YahooChartResponse> = await res.json();

          for (const symbolObj of symbols) {
            const json = batchData[symbolObj.yahoo];
            if (!json) {
              addLog(symbolObj.symbol, false, 'No response from server');
              results[symbolObj.symbol] = {
                symbol: symbolObj.symbol,
                display: symbolObj.display,
                currentPrice: 0,
                bands: null,
                status: 'ok',
                lastUpdated: Date.now(),
                history: [],
                bandPosition: 0.5,
                proximityPct: 0,
                fetchError: 'No response',
              };
              fail++;
              continue;
            }

            const scannerData = processSingleResult(json, symbolObj);
            results[symbolObj.symbol] = scannerData;

            if (scannerData.fetchError) {
              addLog(symbolObj.symbol, false, scannerData.fetchError);
              fail++;
            } else {
              addLog(
                symbolObj.symbol,
                true,
                `Price: ${scannerData.currentPrice.toFixed(
                  symbolObj.type === 'stock' ? 2 : 4
                )} | ${scannerData.bandPosition >= 0.5
                  ? `${Math.round(scannerData.bandPosition * 100)}% to upper`
                  : `${Math.round((1 - scannerData.bandPosition) * 100)}% to lower`}`
              );
              ok++;

              if (scannerData.status !== 'ok') {
                setLastAlert({
                  symbol: symbolObj.symbol,
                  type: scannerData.status,
                  time: Date.now(),
                });
              }
            }
          }
        }
      } catch (err: any) {
        const msg = err?.message ?? 'Network error';
        for (const s of symbols) {
          addLog(s.symbol, false, msg);
          results[s.symbol] = {
            symbol: s.symbol,
            display: s.display,
            currentPrice: 0,
            bands: null,
            status: 'ok',
            lastUpdated: Date.now(),
            history: [],
            bandPosition: 0.5,
            proximityPct: 0,
            fetchError: msg,
          };
          fail++;
        }
      }

      setData((prev) => ({ ...prev, ...results }));
      setSuccessCount(ok);
      setFailCount(fail);
      setLastFetchTime(Date.now());
      setNextFetchTime(Date.now() + POLL_INTERVAL);
      setLoading(false);
      isFetching.current = false;
    };

    fetchAll();

    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [symbols]);

  return {
    data,
    loading,
    lastAlert,
    fetchLogs,
    lastFetchTime,
    nextFetchTime,
    successCount,
    failCount,
  };
}
