// Shared yahoo-finance2 client.
//
// Yahoo's quote/quoteSummary endpoints need a cookie + "crumb" handshake that
// Yahoo frequently blocks from cloud/serverless IPs (Netlify, Vercel, AWS).
// The chart endpoint does NOT need a crumb, so routes should treat chart() as
// the primary data source and quote() as optional enrichment.

type YFClient = {
  quote: (s: string) => Promise<Record<string, unknown>>;
  chart: (
    s: string,
    o: Record<string, unknown>
  ) => Promise<{ meta: Record<string, unknown>; quotes: Record<string, unknown>[] }>;
  search: (q: string, o: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

let client: YFClient | null = null;

// Reuse one instance so the cookie/crumb is fetched once per server instance
// instead of once per request (repeated handshakes trigger Yahoo rate limits).
export function getYahooClient(): YFClient {
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: YahooFinance } = require("yahoo-finance2");
    client = new YahooFinance({
      suppressNotices: ["yahooSurvey", "ripHistorical"],
    }) as YFClient;
  }
  return client;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

// Live price from the chart endpoint's metadata (no crumb required).
export async function getChartPrice(
  symbol: string,
  timeoutMs = 4000
): Promise<{ price: number; change: number } | null> {
  const period1 = new Date();
  period1.setDate(period1.getDate() - 7);
  const chart = await withTimeout(
    getYahooClient().chart(symbol, { period1, interval: "1d" }),
    timeoutMs
  );
  const meta = chart?.meta ?? {};
  const price = meta["regularMarketPrice"];
  if (typeof price !== "number") return null;
  const prev =
    typeof meta["chartPreviousClose"] === "number"
      ? (meta["chartPreviousClose"] as number)
      : typeof meta["previousClose"] === "number"
        ? (meta["previousClose"] as number)
        : null;
  // chartPreviousClose is the close before the chart window; prefer the
  // second-to-last daily close when available for a true day-over-day change.
  const closes = (chart?.quotes ?? [])
    .map((q) => q["close"])
    .filter((c): c is number => typeof c === "number");
  const base = closes.length >= 2 ? closes[closes.length - 2] : prev;
  const change = base ? ((price - base) / base) * 100 : 0;
  return { price, change };
}
