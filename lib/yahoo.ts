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
