import type { Plugin } from 'vite';
import https from 'https';

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 55_000; // 55 seconds (just under our 60s poll interval)
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 4000; // 4 seconds between Yahoo requests

function fetchFromYahoo(symbol: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=5d&includePrePost=false`;

    const options: https.RequestOptions = {
      hostname: 'query2.finance.yahoo.com',
      path: url,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json,text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Yahoo returned ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON from Yahoo'));
        }
      });
    });

    req.on('error', (err: Error) => reject(err));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Yahoo request timeout'));
    });
  });
}

async function fetchWithRateLimit(symbol: string): Promise<any> {
  // Check cache first
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Rate limit: wait if we made a request too recently
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_GAP) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP - timeSinceLast));
  }

  lastRequestTime = Date.now();
  const data = await fetchFromYahoo(symbol);

  // Cache the result
  cache.set(symbol, { data, timestamp: Date.now() });
  return data;
}

export function yahooFinancePlugin(): Plugin {
  return {
    name: 'yahoo-finance-server',
    configureServer(server) {
      // Handle /api/chart?symbol=EURUSD=X
      server.middlewares.use('/api/chart', async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const symbol = url.searchParams.get('symbol');

        if (!symbol) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing symbol parameter' }));
          return;
        }

        try {
          const data = await fetchWithRateLimit(symbol);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (err: any) {
          console.error(`[yahoo] Error fetching ${symbol}:`, err.message);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Batch endpoint: /api/charts?symbols=EURUSD=X,GBPUSD=X,MSFT
      server.middlewares.use('/api/charts', async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const symbolsStr = url.searchParams.get('symbols');

        if (!symbolsStr) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing symbols parameter' }));
          return;
        }

        const symbols = symbolsStr.split(',').map((s) => s.trim());
        const results: Record<string, any> = {};

        for (const symbol of symbols) {
          try {
            results[symbol] = await fetchWithRateLimit(symbol);
          } catch (err: any) {
            console.error(`[yahoo] Error fetching ${symbol}:`, err.message);
            results[symbol] = { error: err.message };
          }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(results));
      });
    },
  };
}
