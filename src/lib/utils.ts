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
