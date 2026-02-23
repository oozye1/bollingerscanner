export interface CandleData {
  c: number[]; // close prices
  h: number[]; // high prices
  l: number[]; // low prices
  o: number[]; // open prices
  t: number[]; // timestamps
  s: string;   // status
}

export interface BollingerBand {
  upper: number;
  middle: number;
  lower: number;
}

export interface ScannerData {
  symbol: string;
  display: string;
  currentPrice: number;
  bands: BollingerBand | null;
  status: 'ok' | 'near-upper' | 'near-lower' | 'above-upper' | 'below-lower';
  lastUpdated: number;
  history: number[]; // Last N closing prices for sparkline
}

export const calculateSMA = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
};

export const calculateBollingerBands = (data: number[], period: number = 20, stdDev: number = 2): BollingerBand | null => {
  if (data.length < period) return null;
  
  const sma = calculateSMA(data, period);
  const slice = data.slice(-period);
  const squaredDiffs = slice.map(val => Math.pow(val - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(variance);

  return {
    middle: sma,
    upper: sma + (sd * stdDev),
    lower: sma - (sd * stdDev)
  };
};
