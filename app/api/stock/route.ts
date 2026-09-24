import { NextRequest, NextResponse } from "next/server";
import { calculateMetrics, generateInsights } from "@/lib/calculations";
import { getDemoData } from "@/lib/demoData";
import { HistoricalDataPoint, StockQuote } from "@/lib/types";
import { getYahooClient, withTimeout } from "@/lib/yahoo";
import { fetchHistory, Interval } from "@/lib/marketData";

export const runtime = "nodejs";

const RANGE_MAP: Record<string, { days: number; interval: string }> = {
  "1M": { days: 30,   interval: "1d" },
  "3M": { days: 90,   interval: "1d" },
  "6M": { days: 180,  interval: "1d" },
  "1Y": { days: 365,  interval: "1d" },
  "2Y": { days: 730,  interval: "1wk" },
  "5Y": { days: 1825, interval: "1wk" },
};

async function fetchLive(
  symbol: string,
  range: string
): Promise<{ data: { quote: StockQuote; historical: HistoricalDataPoint[]; source: string } | null; errors: string[] }> {
  try {
    const config = RANGE_MAP[range] ?? RANGE_MAP["1Y"];

    // Price history is the source of truth (with non-Yahoo fallbacks). quote()
    // needs Yahoo's cookie/crumb handshake, which is often blocked on serverless
    // hosts, so it's optional enrichment only.
    const [history, quoteRes] = await Promise.all([
      fetchHistory(symbol, config.days, config.interval as Interval),
      withTimeout(getYahooClient().quote(symbol), 5000).then(
        (v) => v,
        (err) => { console.warn(`[stock] Yahoo quote failed for ${symbol}:`, err); return null; }
      ),
    ]);

    if (history.errors.length) {
      console.warn(`[stock] data source errors for ${symbol}:`, history.errors.join(" | "));
    }
    if (!history.result) return { data: null, errors: history.errors };

    const { historical, meta, source } = history.result;
    const q = (quoteRes ?? {}) as Record<string, unknown>;
    const pick = (f: string): unknown => (q[f] ?? meta[f]);
    const n = (f: string, fb = 0) => { const v = pick(f); return typeof v === "number" ? v : fb; };
    const s = (f: string): string | null => { const v = pick(f); return typeof v === "string" ? v : null; };
    const opt = (f: string): number | null => (typeof q[f] === "number" ? (q[f] as number) : null);

    const lastClose = historical[historical.length - 1].close;
    const price = n("regularMarketPrice", lastClose);

    // Derive change fields from history when quote() is unavailable.
    let change = opt("regularMarketChange");
    let changePct = opt("regularMarketChangePercent");
    if (change === null || changePct === null) {
      const prev = typeof meta["previousClose"] === "number"
        ? (meta["previousClose"] as number)
        : historical.length >= 2 ? historical[historical.length - 2].close : price;
      change = price - prev;
      changePct = prev ? (change / prev) * 100 : 0;
    }

    const recent = historical.slice(-60);
    const avgVolume = recent.reduce((sum, d) => sum + d.volume, 0) / (recent.length || 1);
    const closes = historical.map((d) => d.close);

    const quote: StockQuote = {
      symbol:                    s("symbol")      ?? symbol,
      shortName:                 s("shortName")   ?? s("longName") ?? symbol,
      regularMarketPrice:        price,
      regularMarketChange:       change,
      regularMarketChangePercent:changePct,
      regularMarketVolume:       n("regularMarketVolume", historical[historical.length - 1].volume),
      marketCap:                 n("marketCap"),
      fiftyTwoWeekHigh:          n("fiftyTwoWeekHigh", Math.max(...closes)),
      fiftyTwoWeekLow:           n("fiftyTwoWeekLow", Math.min(...closes)),
      averageVolume:             n("averageVolume", avgVolume),
      trailingPE:   opt("trailingPE"),
      forwardPE:    opt("forwardPE"),
      dividendYield:opt("dividendYield"),
      sector:   s("sector"),
      industry: s("industry"),
    };

    return { data: { quote, historical, source }, errors: history.errors };
  } catch (err) {
    console.error(`[stock] live fetch failed for ${symbol}:`, err);
    return { data: null, errors: [String(err)] };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase().trim();
  const range  = searchParams.get("range") ?? "1Y";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  const { data: live, errors } = await fetchLive(symbol, range);

  if (live) {
    const metrics  = calculateMetrics(live.historical, live.quote.regularMarketPrice);
    const insights = generateInsights(metrics, symbol);
    return NextResponse.json({ ...live, metrics, insights, demo: false });
  }

  // Fallback: generate realistic demo data so the UI always works. demoReason
  // says why every live source failed, for debugging on the deployed site.
  console.error(`[stock] all live sources failed for ${symbol}:`, errors.join(" | "));
  const demo = getDemoData(symbol, range);
  return NextResponse.json({ ...demo, demo: true, demoReason: errors.join(" | ") });
}
