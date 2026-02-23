import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_SYMBOLS = [
  { symbol: "EURUSD", type: "forex", display: "EUR/USD" },
  { symbol: "GBPUSD", type: "forex", display: "GBP/USD" },
  { symbol: "USDCHF", type: "forex", display: "USD/CHF" },
  { symbol: "USDJPY", type: "forex", display: "USD/JPY" },
  { symbol: "AUDUSD", type: "forex", display: "AUD/USD" },
  { symbol: "NZDUSD", type: "forex", display: "NZD/USD" },
  { symbol: "USDCAD", type: "forex", display: "USD/CAD" },
  { symbol: "MSFT", type: "stock", display: "Microsoft" },
  { symbol: "NVDA", type: "stock", display: "NVIDIA" },
  { symbol: "XAUUSD", type: "forex", display: "Gold/USD" },
];

// Finnhub symbol mapping
export const getFinnhubSymbol = (s: { symbol: string; type: string }) => {
  if (s.type === "forex") {
    // Try OANDA format for forex/commodities
    if (s.symbol.length === 6) {
      return `OANDA:${s.symbol.substring(0, 3)}_${s.symbol.substring(3)}`;
    }
    // Gold/Silver special cases if needed, but XAUUSD usually works as OANDA:XAU_USD
    return `OANDA:${s.symbol}`;
  }
  return s.symbol; // Stocks are just the ticker
};
