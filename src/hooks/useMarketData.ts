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

interface YahooChartResult {
  chart: {
    result: Array<{
      meta: { regularMarketPrice: number; symbol: string };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

function processChartResult(
  result: YahooChartResult['chart']['result'] extends (infer T)[] ? T : never,
  symbolObj: SymbolDef
): ScannerData {
  if (!result?.indicators?.quote?.[0]?.close) {
    return {
      symbol: symbolObj.symbol,
      display: symbolObj.display,
      currentPrice: 0,
      bands: null,
      status: 'ok',
      lastUpdated: Date.now(),
      history: [],
      bandPosition: 0.5,
      proximityPct: 0,
      fetchError: 'No chart data',
    };
  }

  const rawCloses = result.indicators.quote[0].close;
  const closes: number[] = rawCloses.filter(
    (c): c is number => c !== null && c !== undefined && !isNaN(c)
  );

  if (closes.length < 20) {
    return {
      symbol: symbolObj.symbol,
      display: symbolObj.display,
      currentPrice: closes[closes.length - 1] ?? result.meta.regularMarketPrice ?? 0,
      bands: null,
      status: 'ok',
      lastUpdated: Date.now(),
      history: closes.slice(-20),
      bandPosition: 0.5,
      proximityPct: 0,
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

      // Fetch symbols one at a time with generous delay to avoid 429
      for (const symbolObj of symbols) {
        try {
          const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(
            symbolObj.yahoo
          )}?interval=5m&range=5d&includePrePost=false`;

          const res = await fetch(url);

          if (!res.ok) {
            const errText = `HTTP ${res.status}`;
            addLog(symbolObj.symbol, false, errText);
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
              fetchError: errText,
            };
            fail++;
          } else {
            const json: YahooChartResult = await res.json();

            if (json.chart.error) {
              const msg = json.chart.error.description || json.chart.error.code;
              addLog(symbolObj.symbol, false, msg);
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
                fetchError: msg,
              };
              fail++;
            } else if (json.chart.result && json.chart.result[0]) {
              const scannerData = processChartResult(json.chart.result[0], symbolObj);
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
                  )} | Proximity: ${scannerData.proximityPct.toFixed(0)}%`
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
          addLog(symbolObj.symbol, false, msg);
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
            fetchError: msg,
          };
          fail++;
        }

        // 3 second delay between each request to avoid Yahoo rate limiting
        await new Promise((r) => setTimeout(r, 3000));
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
