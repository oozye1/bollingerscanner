import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, ArrowDown, ArrowUp, Bell, BellOff, RefreshCw, Settings, TrendingUp } from 'lucide-react';
import { DEFAULT_SYMBOLS, cn } from './lib/utils';
import { useMarketData } from './hooks/useMarketData';
import { useSoundAlert } from './hooks/useSoundAlert';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { ScannerData } from './lib/indicators';

// Component for the API Key Input
function ApiKeyModal({ onSave }: { onSave: (key: string) => void }) {
  const [key, setKey] = useState('');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-2">Configuration Required</h2>
        <p className="text-zinc-400 mb-6 text-sm">
          To access real-time market data for stocks and forex, you need a free Finnhub API key.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Finnhub API Key</label>
            <input 
              type="text" 
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter your key (e.g. c123...)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          
          <div className="bg-zinc-950/50 rounded-lg p-3 text-xs text-zinc-500">
            <p>1. Go to <a href="https://finnhub.io/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">finnhub.io</a> and sign up (free).</p>
            <p>2. Copy your API key from the dashboard.</p>
            <p>3. Paste it here.</p>
          </div>

          <button 
            onClick={() => onSave(key)}
            disabled={!key}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
          >
            Start Scanner
          </button>
        </div>
      </div>
    </div>
  );
}

interface ScannerRowProps {
  data: ScannerData;
}

function ScannerRow({ data }: ScannerRowProps) {
  const isNearUpper = data.status === 'near-upper';
  const isNearLower = data.status === 'near-lower';
  const isAbove = data.status === 'above-upper';
  const isBelow = data.status === 'below-lower';
  
  const isAlert = isNearUpper || isNearLower || isAbove || isBelow;
  
  return (
    <div className={cn(
      "grid grid-cols-12 gap-4 items-center p-4 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors",
      isAlert && "bg-indigo-900/10"
    )}>
      {/* Symbol Info */}
      <div className="col-span-3">
        <div className="font-bold text-white">{data.display}</div>
        <div className="text-xs text-zinc-500 font-mono">{data.symbol}</div>
      </div>

      {/* Price */}
      <div className="col-span-2 font-mono text-zinc-300">
        {data.currentPrice.toFixed(4)}
      </div>

      {/* Bands Info */}
      <div className="col-span-3 text-xs font-mono space-y-1">
        <div className="flex justify-between text-zinc-500">
          <span>H:</span>
          <span className="text-zinc-400">{data.bands?.upper.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>L:</span>
          <span className="text-zinc-400">{data.bands?.lower.toFixed(4)}</span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="col-span-2 flex justify-center">
        {isAbove && <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20">Overbought</span>}
        {isBelow && <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/20">Oversold</span>}
        {isNearUpper && <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium border border-orange-500/20">Near High</span>}
        {isNearLower && <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium border border-blue-500/20">Near Low</span>}
        {!isAlert && <span className="text-zinc-600 text-xs">-</span>}
      </div>

      {/* Mini Chart */}
      <div className="col-span-2 h-10 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.history.map((v: number, i: number) => ({ i, v }))}>
            <Area 
              type="monotone" 
              dataKey="v" 
              stroke={isAlert ? "#818cf8" : "#52525b"} 
              fill={isAlert ? "#818cf820" : "#52525b10"} 
              strokeWidth={2} 
            />
            <YAxis domain={['auto', 'auto']} hide />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => {
    // Check environment variable first, then local storage
    // Note: In Vite, process.env is replaced at build time, but we defined it in vite.config.ts
    // However, for user input, we might want to persist it.
    return import.meta.env.VITE_FINNHUB_API_KEY || localStorage.getItem('finnhub_api_key') || '';
  });
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { data, loading, lastAlert } = useMarketData(apiKey, DEFAULT_SYMBOLS);
  
  // Trigger sound on alert
  useSoundAlert(soundEnabled ? lastAlert : null);

  const handleSaveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('finnhub_api_key', key);
  };

  const sortedData = Object.values(data).sort((a: ScannerData, b: ScannerData) => {
    // Sort alerts to top
    const aAlert = a.status !== 'ok';
    const bAlert = b.status !== 'ok';
    if (aAlert && !bAlert) return -1;
    if (!aAlert && bAlert) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6">
      {!apiKey && <ApiKeyModal onSave={handleSaveKey} />}

      <header className="max-w-5xl mx-auto mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-500" />
            Bollinger Scanner
          </h1>
          <p className="text-zinc-400 mt-1">Real-time volatility alerts for Forex & Stocks</p>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-3 rounded-xl transition-all border",
              soundEnabled 
                ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20" 
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            )}
          >
            {soundEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", loading ? "bg-amber-500" : "bg-emerald-500")} />
            <span className="text-xs font-medium text-zinc-400">
              {loading ? "Scanning..." : "Live"}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 bg-zinc-900/80 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            <div className="col-span-3">Asset</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-3">Bands (20, 2)</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2">Trend (20)</div>
          </div>

          {/* Rows */}
          <div>
            {sortedData.length > 0 ? (
              sortedData.map((item: ScannerData) => (
                <div key={item.symbol} style={{ display: 'contents' }}>
                  <ScannerRow data={item} />
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-zinc-500">
                {apiKey ? "Waiting for market data..." : "Please configure API key to start scanning."}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Strategy</span>
            </div>
            <p className="text-sm text-zinc-500">
              Alerts trigger when price touches or exceeds the 2.0 Standard Deviation bands (20-period SMA).
            </p>
          </div>
          
          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <RefreshCw className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Refresh Rate</span>
            </div>
            <p className="text-sm text-zinc-500">
              Scanner updates every 60 seconds to respect API rate limits.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Alerts</span>
            </div>
            <p className="text-sm text-zinc-500">
              Audio chime plays when any asset enters "Near High" or "Near Low" zones (within 5% of band).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
