import { NextResponse } from "next/server";
import { getDemoData } from "@/lib/demoData";
import { fetchHistory } from "@/lib/marketData";
import { calculateMetrics, generateInsights } from "@/lib/calculations";
import { HistoricalDataPoint } from "@/lib/types";

export const runtime = "nodejs";

const TICKERS = ["NVDA", "MSFT", "AAPL", "META", "GOOGL", "AMZN", "TSLA", "SPY", "AMD", "QQQ"];

// Twelve Data's free plan allows 8 requests/minute, so at most 7 keyed
// fetches per dashboard request (leaving room for a stock search). Anything
// not fetched this time falls back to demo data and is flagged as such.
const MAX_KEYED_PER_REQUEST = 7;

// Per-instance cache so repeat visits don't spend API credits.
const CACHE_TTL_MS = 30 * 60 * 1000;
type CacheEntry = { at: number; historical: HistoricalDataPoint[]; meta: Record<string, unknown> };
const historyCache = new Map<string, CacheEntry>();

async function getLiveHistory(symbol: string, allowKeyed: boolean): Promise<CacheEntry | null> {
  const hit = historyCache.get(symbol);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  try {
    const { result, errors } = await fetchHistory(symbol, 365, "1d", { allowKeyed });
    if (!result) {
      console.warn(`[dashboard] live data failed for ${symbol}:`, errors.join(" | "));
      return hit ?? null; // stale live data beats demo data
    }
    const entry = { at: Date.now(), historical: result.historical, meta: result.meta };
    historyCache.set(symbol, entry);
    return entry;
  } catch (err) {
    console.warn(`[dashboard] live data failed for ${symbol}:`, err);
    return hit ?? null;
  }
}

export async function GET() {
  let keyedBudget = MAX_KEYED_PER_REQUEST;
  const results = await Promise.all(
    TICKERS.map(async (symbol) => {
      const demo = getDemoData(symbol, "1Y");
      const cached = historyCache.get(symbol);
      const fresh = !!cached && Date.now() - cached.at < CACHE_TTL_MS;
      // Budget is claimed synchronously (before any await), so it's race-free.
      const allowKeyed = !fresh && keyedBudget > 0;
      if (allowKeyed) keyedBudget--;

      const live = await getLiveHistory(symbol, allowKeyed);
      const h = live?.historical ?? [];
      const hasLive = h.length >= 2;

      const metaPrice = live?.meta["regularMarketPrice"];
      const price = !hasLive
        ? demo.quote.regularMarketPrice
        : typeof metaPrice === "number" ? metaPrice : h[h.length - 1].close;
      const prev = hasLive ? h[h.length - 2].close : price;

      // Score from real price history when available, demo data otherwise.
      const metrics  = hasLive ? calculateMetrics(h, price) : demo.metrics;
      const insights = hasLive ? generateInsights(metrics, symbol) : demo.insights;

      return {
        symbol,
        name: demo.quote.shortName,
        sector: demo.quote.sector ?? "Technology",
        price,
        change: hasLive ? (prev ? ((price - prev) / prev) * 100 : 0) : demo.quote.regularMarketChangePercent,
        score: insights.score,
        confidence: insights.confidence,
        trend: metrics.trendDirection,
        volatility: parseFloat(metrics.volatility.toFixed(1)),
        riskLevel: (metrics.volatility > 30 ? "high" : metrics.volatility > 20 ? "medium" : "low") as "low" | "medium" | "high",
        sharpe: parseFloat(metrics.sharpeRatio.toFixed(2)),
        totalReturn: parseFloat(metrics.totalReturn.toFixed(1)),
        livePrice: hasLive,
      };
    })
  );

  results.sort((a, b) => b.score - a.score);
  const allLive = results.every((r) => r.livePrice);
  return NextResponse.json(
    { stocks: results, updatedAt: new Date().toISOString() },
    {
      headers: {
        // Let Netlify's CDN reuse a fully-live response for 15 minutes so each
        // page view doesn't spend API credits; partial results expire quickly.
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": allLive
          ? "public, s-maxage=900, stale-while-revalidate=3600"
          : "public, s-maxage=60",
      },
    }
  );
}
