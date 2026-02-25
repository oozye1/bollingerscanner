import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 25_000;

function fetchFromYahoo(symbol: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlPath = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;

    const options: https.RequestOptions = {
      hostname: 'query2.finance.yahoo.com',
      path: urlPath,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
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
      reject(new Error('Request timeout'));
    });
  });
}

async function fetchWithCache(symbol: string): Promise<any> {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchFromYahoo(symbol);
  cache.set(symbol, { data, timestamp: Date.now() });
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const symbolsStr = req.query.symbols as string;
  if (!symbolsStr) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
  }

  const symbols = symbolsStr.split(',').map((s) => s.trim());
  const results: Record<string, any> = {};

  // Fetch sequentially with small delay to avoid Yahoo rate limiting
  for (const symbol of symbols) {
    try {
      results[symbol] = await fetchWithCache(symbol);
    } catch (err: any) {
      results[symbol] = { error: err.message };
    }
    // Small delay between uncached requests
    await new Promise((r) => setTimeout(r, 500));
  }

  return res.status(200).json(results);
}
