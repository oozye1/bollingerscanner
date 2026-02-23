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

export type AlertStatus = 'ok' | 'near-upper' | 'near-lower' | 'above-upper' | 'below-lower';

export interface ScannerData {
  symbol: string;
  display: string;
  currentPrice: number;
  bands: BollingerBand | null;
  status: AlertStatus;
  lastUpdated: number;
  history: number[]; // Last N closing prices for sparkline
  /** 0 = at lower band, 0.5 = at middle (SMA), 1.0 = at upper band. Can exceed 0-1 range. */
  bandPosition: number;
  /** How close to triggering an alert: 0 = middle of bands, 100 = at the band edge */
  proximityPct: number;
  fetchError?: string;
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

/** Returns 0..1 position of price within band range (0=lower, 1=upper). Can exceed range. */
export const getBandPosition = (price: number, bands: BollingerBand): number => {
  const range = bands.upper - bands.lower;
  if (range === 0) return 0.5;
  return (price - bands.lower) / range;
};

/** Returns 0..100+ proximity to nearest band edge. 100 = at band, >100 = beyond band. */
export const getProximityPct = (price: number, bands: BollingerBand): number => {
  const halfRange = (bands.upper - bands.lower) / 2;
  if (halfRange === 0) return 0;
  const distFromMiddle = Math.abs(price - bands.middle);
  return (distFromMiddle / halfRange) * 100;
};
