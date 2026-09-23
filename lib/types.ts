export interface StockQuote {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketCap: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  averageVolume: number;
  trailingPE: number | null;
  forwardPE: number | null;
  dividendYield: number | null;
  sector: string | null;
  industry: string | null;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
}

export interface StockMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgVolume: number;
  ma20: number;
  ma50: number;
  ma200: number;
  currentPrice: number;
  rsi: number;
  beta: number;
  trendDirection: "bullish" | "bearish" | "neutral";
}

export interface AIInsight {
  summary: string;
  momentum: string;
  risk: string;
  trend: string;
  recommendation: string;
  score: number;
  confidence: "low" | "medium" | "high";
}

export interface StockData {
  quote: StockQuote;
  historical: HistoricalDataPoint[];
  metrics: StockMetrics;
  insights: AIInsight;
  demo?: boolean;
  demoReason?: string;
  source?: string;
}

export type TimeRange = "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y";
