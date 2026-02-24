import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_SYMBOLS = [
  { symbol: "EURUSD", type: "forex", display: "EUR/USD", yahoo: "EURUSD=X" },
  { symbol: "GBPUSD", type: "forex", display: "GBP/USD", yahoo: "GBPUSD=X" },
  { symbol: "USDCHF", type: "forex", display: "USD/CHF", yahoo: "USDCHF=X" },
  { symbol: "USDJPY", type: "forex", display: "USD/JPY", yahoo: "USDJPY=X" },
  { symbol: "AUDUSD", type: "forex", display: "AUD/USD", yahoo: "AUDUSD=X" },
  { symbol: "NZDUSD", type: "forex", display: "NZD/USD", yahoo: "NZDUSD=X" },
  { symbol: "USDCAD", type: "forex", display: "USD/CAD", yahoo: "USDCAD=X" },
  { symbol: "MSFT", type: "stock", display: "Microsoft", yahoo: "MSFT" },
  { symbol: "NVDA", type: "stock", display: "NVIDIA", yahoo: "NVDA" },
  { symbol: "XAUUSD", type: "forex", display: "Gold/USD", yahoo: "GC=F" },
];

export type SymbolDef = (typeof DEFAULT_SYMBOLS)[number];

/**
 * Check if a market is currently open for a given symbol type.
 * - Stocks: Mon-Fri 9:30 AM - 4:00 PM Eastern Time
 * - Forex/Gold: Mon-Fri (Sun 10pm UTC to Fri 10pm UTC — effectively 24h on weekdays)
 */
export function isMarketOpen(type: string): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();

  if (type === 'stock') {
    // US stock market: Mon-Fri, 9:30-16:00 ET
    // ET = UTC-5 (EST) or UTC-4 (EDT)
    // Use Intl to get actual ET offset
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const etDate = new Date(etStr);
    const etDay = etDate.getDay();
    const etHour = etDate.getHours();
    const etMin = etDate.getMinutes();
    const etTime = etHour * 60 + etMin;

    if (etDay === 0 || etDay === 6) return false; // Weekend
    return etTime >= 570 && etTime < 960; // 9:30 (570min) to 16:00 (960min)
  }

  // Forex / Gold / Futures: open Sun 22:00 UTC to Fri 22:00 UTC
  if (utcDay === 6) return false; // Saturday always closed
  if (utcDay === 0 && utcHour < 22) return false; // Sunday before 10pm UTC
  if (utcDay === 5 && utcHour >= 22) return false; // Friday after 10pm UTC
  return true;
}
