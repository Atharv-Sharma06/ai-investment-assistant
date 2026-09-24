// Ticker suggestions for unknown symbols / company names ("MIRCON" → MU,
// "APPLE" → AAPL). Combines a small built-in list (typo-tolerant, no network)
// with Twelve Data's symbol search when TWELVE_DATA_API_KEY is set.

export interface SymbolSuggestion {
  symbol: string;
  name: string;
}

const POPULAR: SymbolSuggestion[] = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Google)" },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "META", name: "Meta Platforms (Facebook)" },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "MU", name: "Micron Technology" },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "QCOM", name: "Qualcomm Inc." },
  { symbol: "TSM", name: "Taiwan Semiconductor (TSMC)" },
  { symbol: "ORCL", name: "Oracle Corporation" },
  { symbol: "CRM", name: "Salesforce Inc." },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "DIS", name: "Walt Disney Company" },
  { symbol: "UBER", name: "Uber Technologies" },
  { symbol: "PYPL", name: "PayPal Holdings" },
  { symbol: "SHOP", name: "Shopify Inc." },
  { symbol: "PLTR", name: "Palantir Technologies" },
  { symbol: "IBM", name: "IBM" },
  { symbol: "CSCO", name: "Cisco Systems" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "MA", name: "Mastercard Inc." },
  { symbol: "BRK-B", name: "Berkshire Hathaway" },
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "COST", name: "Costco Wholesale" },
  { symbol: "KO", name: "Coca-Cola Company" },
  { symbol: "PEP", name: "PepsiCo Inc." },
  { symbol: "MCD", name: "McDonald's Corporation" },
  { symbol: "SBUX", name: "Starbucks Corporation" },
  { symbol: "NKE", name: "Nike Inc." },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "PFE", name: "Pfizer Inc." },
  { symbol: "LLY", name: "Eli Lilly and Company" },
  { symbol: "UNH", name: "UnitedHealth Group" },
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "CVX", name: "Chevron Corporation" },
  { symbol: "BA", name: "Boeing Company" },
  { symbol: "F", name: "Ford Motor Company" },
  { symbol: "GM", name: "General Motors" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF" },
  { symbol: "QQQ", name: "Invesco QQQ (Nasdaq-100) ETF" },
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
];

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

// Distance from the query to a ticker or any word of its company name.
function localScore(query: string, s: SymbolSuggestion): number {
  const q = query.toUpperCase();
  const words = s.name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
  if (words.some((w) => w.startsWith(q) && q.length >= 3)) return 0;
  const candidates = [s.symbol, ...words];
  return Math.min(...candidates.map((c) => levenshtein(q, c)));
}

function localSuggestions(query: string): SymbolSuggestion[] {
  const maxDist = query.length <= 4 ? 1 : 2;
  return POPULAR.map((s) => ({ s, d: localScore(query, s) }))
    .filter(({ d }) => d <= maxDist)
    .sort((a, b) => a.d - b.d)
    .map(({ s }) => s);
}

async function twelveDataSuggestions(query: string): Promise<SymbolSuggestion[]> {
  const key = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!key) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=10&apikey=${key}`,
      { signal: controller.signal, cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? (json.data as Record<string, string>[]) : [];
    // Prefer US listings, since those are what the data sources cover best.
    return rows
      .filter((r) => r.symbol && r.instrument_name)
      .sort((a, b) => Number(b.country === "United States") - Number(a.country === "United States"))
      .map((r) => ({ symbol: r.symbol, name: r.instrument_name }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function suggestSymbols(query: string, limit = 3): Promise<SymbolSuggestion[]> {
  const [local, remote] = await Promise.all([
    Promise.resolve(localSuggestions(query)),
    twelveDataSuggestions(query),
  ]);
  const seen = new Set<string>();
  const out: SymbolSuggestion[] = [];
  for (const s of [...local, ...remote]) {
    if (s.symbol === query.toUpperCase() || seen.has(s.symbol)) continue;
    seen.add(s.symbol);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
