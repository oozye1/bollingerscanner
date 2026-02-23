import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  TrendingUp,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { DEFAULT_SYMBOLS, cn } from './lib/utils';
import { useMarketData, type FetchLog } from './hooks/useMarketData';
import { useSoundAlert } from './hooks/useSoundAlert';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts';
import type { ScannerData } from './lib/indicators';

/* ─────────────────────── Band Proximity Gauge ─────────────────────── */

function BandGauge({ data }: { data: ScannerData }) {
  if (!data.bands) return <div className="text-xs text-zinc-600 italic">No band data</div>;

  // bandPosition: 0 = lower band, 0.5 = SMA, 1.0 = upper band
  const pos = Math.max(-0.1, Math.min(1.1, data.bandPosition));
  const pctLeft = Math.max(0, Math.min(100, pos * 100));

  // Color for the marker based on position
  const getMarkerColor = () => {
    if (pos >= 0.95) return 'bg-red-500 shadow-red-500/50';
    if (pos >= 0.85) return 'bg-orange-500 shadow-orange-500/50';
    if (pos <= 0.05) return 'bg-emerald-500 shadow-emerald-500/50';
    if (pos <= 0.15) return 'bg-teal-500 shadow-teal-500/50';
    return 'bg-indigo-400 shadow-indigo-400/50';
  };

  // Signal label for mean reversion
  const getSignalLabel = () => {
    if (data.status === 'above-upper')
      return (
        <span className="text-red-400 font-bold text-xs flex items-center gap-1">
          <ChevronDown className="w-3 h-3" /> SELL SIGNAL
        </span>
      );
    if (data.status === 'below-lower')
      return (
        <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
          <ChevronUp className="w-3 h-3" /> BUY SIGNAL
        </span>
      );
    if (data.status === 'near-upper')
      return (
        <span className="text-orange-400 font-medium text-xs flex items-center gap-1">
          <ChevronDown className="w-3 h-3" /> Near sell zone
        </span>
      );
    if (data.status === 'near-lower')
      return (
        <span className="text-teal-400 font-medium text-xs flex items-center gap-1">
          <ChevronUp className="w-3 h-3" /> Near buy zone
        </span>
      );
    return <span className="text-zinc-600 text-xs">Neutral</span>;
  };

  const isAlert =
    data.status === 'above-upper' ||
    data.status === 'below-lower' ||
    data.status === 'near-upper' ||
    data.status === 'near-lower';

  return (
    <div className="space-y-1.5">
      {/* Signal label */}
      <div className="flex items-center justify-between">
        {getSignalLabel()}
        <span className="text-[10px] font-mono text-zinc-500">
          {data.bandPosition >= 0.5
            ? `${Math.round(data.bandPosition * 100)}% to upper`
            : `${Math.round((1 - data.bandPosition) * 100)}% to lower`}
        </span>
      </div>

      {/* The gauge track */}
      <div className="relative h-3 rounded-full overflow-visible">
        {/* Background track with gradient: green → gray → red */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div
            className="w-full h-full"
            style={{
              background:
                'linear-gradient(to right, #10b981 0%, #10b98133 10%, #27272a 35%, #3f3f46 50%, #27272a 65%, #ef444433 90%, #ef4444 100%)',
            }}
          />
        </div>

        {/* Alert zone markers (5% from each edge) */}
        <div
          className="absolute top-0 h-full border-l border-dashed border-emerald-500/40"
          style={{ left: '5%' }}
        />
        <div
          className="absolute top-0 h-full border-l border-dashed border-red-500/40"
          style={{ left: '95%' }}
        />

        {/* SMA center line */}
        <div
          className="absolute top-0 h-full w-px bg-zinc-500/60"
          style={{ left: '50%' }}
        />

        {/* Price marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${pctLeft}%` }}
        >
          <div
            className={cn(
              'w-3.5 h-3.5 rounded-full border-2 border-white/90 shadow-lg transition-all duration-500',
              getMarkerColor(),
              isAlert && 'animate-pulse scale-125'
            )}
          />
        </div>
      </div>

      {/* Band labels */}
      <div className="flex justify-between text-[10px] font-mono text-zinc-600">
        <span>{data.bands.lower.toFixed(4)}</span>
        <span className="text-zinc-500">{data.bands.middle.toFixed(4)}</span>
        <span>{data.bands.upper.toFixed(4)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────── Mini Chart with Bands ─────────────────────── */

function MiniChart({ data }: { data: ScannerData }) {
  if (data.history.length === 0) return null;

  const chartData = data.history.map((v, i) => ({ i, v }));
  const isAlert = data.status !== 'ok';

  const strokeColor = (() => {
    switch (data.status) {
      case 'above-upper':
        return '#ef4444';
      case 'below-lower':
        return '#10b981';
      case 'near-upper':
        return '#f97316';
      case 'near-lower':
        return '#14b8a6';
      default:
        return '#6366f1';
    }
  })();

  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          {data.bands && (
            <>
              <ReferenceLine
                y={data.bands.upper}
                stroke="#ef444440"
                strokeDasharray="2 2"
              />
              <ReferenceLine
                y={data.bands.middle}
                stroke="#71717a40"
                strokeDasharray="2 2"
              />
              <ReferenceLine
                y={data.bands.lower}
                stroke="#10b98140"
                strokeDasharray="2 2"
              />
            </>
          )}
          <Area
            type="monotone"
            dataKey="v"
            stroke={strokeColor}
            fill={`${strokeColor}15`}
            strokeWidth={2}
          />
          <YAxis domain={['auto', 'auto']} hide />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────── Scanner Card ─────────────────────── */

function ScannerCard({ data }: { data: ScannerData }) {
  const isAlert =
    data.status === 'above-upper' ||
    data.status === 'below-lower' ||
    data.status === 'near-upper' ||
    data.status === 'near-lower';

  const isStrongSignal = data.status === 'above-upper' || data.status === 'below-lower';

  const borderColor = (() => {
    if (data.status === 'above-upper') return 'border-red-500/40';
    if (data.status === 'below-lower') return 'border-emerald-500/40';
    if (data.status === 'near-upper') return 'border-orange-500/30';
    if (data.status === 'near-lower') return 'border-teal-500/30';
    return 'border-zinc-800/50';
  })();

  const glowStyle = (() => {
    if (data.status === 'above-upper') return { boxShadow: '0 0 20px rgba(239,68,68,0.15)' };
    if (data.status === 'below-lower') return { boxShadow: '0 0 20px rgba(16,185,129,0.15)' };
    return {};
  })();

  return (
    <div
      className={cn(
        'rounded-xl border bg-zinc-900/60 p-4 transition-all duration-300 hover:bg-zinc-900/80',
        borderColor,
        isStrongSignal && 'ring-1',
        data.status === 'above-upper' && 'ring-red-500/20',
        data.status === 'below-lower' && 'ring-emerald-500/20'
      )}
      style={glowStyle}
    >
      {/* Header: Symbol + Price */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-bold text-white text-lg leading-tight">{data.display}</div>
          <div className="text-xs text-zinc-500 font-mono">{data.symbol}</div>
        </div>
        <div className="text-right">
          {data.fetchError ? (
            <div className="text-xs text-amber-500/80 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              {data.fetchError}
            </div>
          ) : (
            <>
              <div className="font-mono text-white text-lg font-semibold leading-tight">
                {data.currentPrice.toFixed(data.currentPrice > 10 ? 2 : 4)}
              </div>
              {isStrongSignal && (
                <div
                  className={cn(
                    'text-xs font-bold mt-0.5',
                    data.status === 'above-upper' ? 'text-red-400' : 'text-emerald-400'
                  )}
                >
                  {data.status === 'above-upper' ? 'OVERBOUGHT' : 'OVERSOLD'}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Proximity Gauge */}
      {!data.fetchError && <BandGauge data={data} />}

      {/* Mini Chart */}
      {!data.fetchError && (
        <div className="mt-3 -mx-1">
          <MiniChart data={data} />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Countdown Timer ─────────────────────── */

function CountdownTimer({ nextFetchTime }: { nextFetchTime: number | null }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!nextFetchTime) return;
    const tick = () => {
      const diff = Math.max(0, Math.ceil((nextFetchTime - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextFetchTime]);

  if (!nextFetchTime) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
      <Clock className="w-3.5 h-3.5" />
      <span>Next scan in {secondsLeft}s</span>
    </div>
  );
}

/* ─────────────────────── Status Bar ─────────────────────── */

function StatusBar({
  loading,
  successCount,
  failCount,
  lastFetchTime,
  nextFetchTime,
  fetchLogs,
}: {
  loading: boolean;
  successCount: number;
  failCount: number;
  lastFetchTime: number | null;
  nextFetchTime: number | null;
  fetchLogs: FetchLog[];
}) {
  const [showLogs, setShowLogs] = useState(false);

  const lastTimeStr = lastFetchTime
    ? new Date(lastFetchTime).toLocaleTimeString()
    : 'Never';

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {loading ? (
              <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
            ) : successCount > 0 ? (
              <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span
              className={cn(
                'text-sm font-medium',
                loading
                  ? 'text-amber-400'
                  : successCount > 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
              )}
            >
              {loading ? 'Scanning...' : successCount > 0 ? 'Connected' : 'No data'}
            </span>
          </div>

          {/* Fetch stats */}
          {!loading && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-500/70">
                <CheckCircle2 className="w-3 h-3" />
                {successCount} OK
              </span>
              {failCount > 0 && (
                <span className="flex items-center gap-1 text-red-500/70">
                  <XCircle className="w-3 h-3" />
                  {failCount} failed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timing */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-600">Last: {lastTimeStr}</span>
          <CountdownTimer nextFetchTime={nextFetchTime} />

          {/* Log toggle */}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline decoration-dotted"
          >
            {showLogs ? 'Hide logs' : 'Show logs'}
          </button>
        </div>
      </div>

      {/* Expandable log panel */}
      {showLogs && (
        <div className="mt-3 max-h-48 overflow-y-auto border-t border-zinc-800 pt-2 space-y-0.5">
          {fetchLogs.length === 0 ? (
            <p className="text-xs text-zinc-600">No fetch logs yet...</p>
          ) : (
            fetchLogs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  'text-[11px] font-mono flex items-start gap-2',
                  log.ok ? 'text-zinc-500' : 'text-red-400/70'
                )}
              >
                <span className="text-zinc-700 shrink-0">
                  {new Date(log.time).toLocaleTimeString()}
                </span>
                <span className={cn('shrink-0 w-1.5 h-1.5 rounded-full mt-1', log.ok ? 'bg-emerald-500' : 'bg-red-500')} />
                <span className="shrink-0 text-zinc-600 w-16">{log.symbol}</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Summary Stats ─────────────────────── */

function SummaryStats({ data }: { data: ScannerData[] }) {
  const buySignals = data.filter(
    (d) => d.status === 'below-lower' || d.status === 'near-lower'
  ).length;
  const sellSignals = data.filter(
    (d) => d.status === 'above-upper' || d.status === 'near-upper'
  ).length;
  const activeAlerts = buySignals + sellSignals;
  const totalTracked = data.filter((d) => !d.fetchError).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Tracking</div>
        <div className="text-2xl font-bold text-white">{totalTracked}</div>
        <div className="text-xs text-zinc-600">instruments</div>
      </div>
      <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Active Alerts</div>
        <div
          className={cn(
            'text-2xl font-bold',
            activeAlerts > 0 ? 'text-indigo-400' : 'text-zinc-600'
          )}
        >
          {activeAlerts}
        </div>
        <div className="text-xs text-zinc-600">signals</div>
      </div>
      <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-lg p-3">
        <div className="text-xs text-emerald-600 uppercase tracking-wider mb-1">Buy Zone</div>
        <div
          className={cn(
            'text-2xl font-bold',
            buySignals > 0 ? 'text-emerald-400' : 'text-zinc-600'
          )}
        >
          {buySignals}
        </div>
        <div className="text-xs text-emerald-700">mean reversion long</div>
      </div>
      <div className="bg-red-950/30 border border-red-900/30 rounded-lg p-3">
        <div className="text-xs text-red-600 uppercase tracking-wider mb-1">Sell Zone</div>
        <div
          className={cn(
            'text-2xl font-bold',
            sellSignals > 0 ? 'text-red-400' : 'text-zinc-600'
          )}
        >
          {sellSignals}
        </div>
        <div className="text-xs text-red-700">mean reversion short</div>
      </div>
    </div>
  );
}

/* ─────────────────────── Main App ─────────────────────── */

export default function App() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const {
    data,
    loading,
    lastAlert,
    fetchLogs,
    lastFetchTime,
    nextFetchTime,
    successCount,
    failCount,
  } = useMarketData(DEFAULT_SYMBOLS);

  useSoundAlert(soundEnabled ? lastAlert : null);

  const allData = Object.values(data) as ScannerData[];

  // Sort: strong signals first, then near signals, then by proximity descending
  const sortedData = [...allData].sort((a, b) => {
    const priority = (d: ScannerData) => {
      if (d.status === 'above-upper' || d.status === 'below-lower') return 3;
      if (d.status === 'near-upper' || d.status === 'near-lower') return 2;
      if (d.fetchError) return -1;
      return 0;
    };
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pb - pa;
    return b.proximityPct - a.proximityPct;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* ── Header ── */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-500" />
              Bollinger Scanner
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Mean reversion alerts &middot; Bollinger Bands (20, 2.0 SD) &middot; 5m candles
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                'p-2.5 rounded-lg transition-all border',
                soundEnabled
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              )}
              title={soundEnabled ? 'Sound on' : 'Sound off'}
            >
              {soundEnabled ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* ── Status Bar ── */}
        <StatusBar
            loading={loading}
            successCount={successCount}
            failCount={failCount}
            lastFetchTime={lastFetchTime}
            nextFetchTime={nextFetchTime}
            fetchLogs={fetchLogs}
          />

        {/* ── Summary Stats ── */}
        {allData.length > 0 && <SummaryStats data={allData} />}

        {/* ── Scanner Cards Grid ── */}
        {sortedData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedData.map((item) => (
              <ScannerCard key={item.symbol} data={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-16 text-center">
            <div className="space-y-3">
              <RefreshCw className="w-8 h-8 text-zinc-600 mx-auto animate-spin" />
              <p className="text-zinc-500">Fetching market data...</p>
              <p className="text-xs text-zinc-700">
                This may take 10-20 seconds on first load
              </p>
            </div>
          </div>
        )}

        {/* ── Strategy Info ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Mean Reversion</span>
            </div>
            <p className="text-sm text-zinc-500">
              Buy at lower band, sell at upper band. Price tends to revert to the 20-period
              SMA (middle line).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Gauge Reading</span>
            </div>
            <p className="text-sm text-zinc-500">
              The proximity bar shows where price sits between the bands. Dot near the edges
              = potential entry. The closer to 100%, the closer to a signal.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Alerts</span>
            </div>
            <p className="text-sm text-zinc-500">
              Audio chime when any asset enters the buy or sell zone (within 5% of band edge).
              Cards glow and sort to the top.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
