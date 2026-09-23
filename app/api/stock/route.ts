import { NextRequest, NextResponse } from "next/server";
import { calculateMetrics, generateInsights } from "@/lib/calculations";
import { getDemoData } from "@/lib/demoData";
import { HistoricalDataPoint, StockQuote } from "@/lib/types";
import { getYahooClient, withTimeout } from "@/lib/yahoo";

export const runtime = "nodejs";

const RANGE_MAP: Record<string, { days: number; interval: string }> = {
  "1M": { days: 30,   interval: "1d" },
  "3M": { days: 90,   interval: "1d" },
  "6M": { days: 180,  interval: "1d" },
  "1Y": { days: 365,  interval: "1d" },
  "2Y": { days: 730,  interval: "1wk" },
  "5Y": { days: 1825, interval: "1wk" },
};

function subDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function fetchFromYahoo(
  symbol: string,
  range: string
): Promise<{ quote: StockQuote; historical: HistoricalDataPoint[]; demo: false } | null> {
  try {
    const yf = getYahooClient();
    const config = RANGE_MAP[range] ?? RANGE_MAP["1Y"];

    // chart() needs no crumb and is the source of truth; quote() needs Yahoo's
    // cookie/crumb handshake, which is often blocked on serverless hosts, so a
    // quote failure must not throw away the chart data.
    const [chartRes, quoteRes] = await Promise.allSettled([
      withTimeout(yf.chart(symbol, { period1: subDays(config.days), interval: config.interval }), 8000),
      withTimeout(yf.quote(symbol), 5000),
    ]);

    if (chartRes.status === "rejected") {
      console.error(`[stock] Yahoo chart failed for ${symbol}:`, chartRes.reason);
      return null;
    }
    if (quoteRes.status === "rejected") {
      console.warn(`[stock] Yahoo quote failed for ${symbol}, using chart metadata:`, quoteRes.reason);
    }

    const rawQuotes = chartRes.value?.quotes ?? [];
    if (rawQuotes.length === 0) return null;

    const meta = (chartRes.value?.meta ?? {}) as Record<string, unknown>;
    const q = (quoteRes.status === "fulfilled" && quoteRes.value ? quoteRes.value : {}) as Record<string, unknown>;
    const pick = (f: string): unknown => (q[f] ?? meta[f]);
    const n = (f: string, fb = 0) => { const v = pick(f); return typeof v === "number" ? v : fb; };
    const s = (f: string): string | null => { const v = pick(f); return typeof v === "string" ? v : null; };
    const opt = (f: string): number | null => (typeof q[f] === "number" ? (q[f] as number) : null);

    const historical: HistoricalDataPoint[] = rawQuotes
      .filter((d) => d["close"] != null)
      .map((d) => {
        const num = (f: string, fb = 0) => (typeof d[f] === "number" ? (d[f] as number) : fb);
        const close = num("close");
        const dateVal = d["date"];
        const dateStr = dateVal instanceof Date
          ? dateVal.toISOString().split("T")[0]
          : String(dateVal).split("T")[0];
        return {
          date: dateStr,
          open: num("open", close),
          high: num("high", close),
          low:  num("low",  close),
          close,
          volume:   num("volume"),
          adjClose: num("adjclose", close),
        };
      });
    if (historical.length === 0) return null;

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

    return { quote, historical, demo: false };
  } catch (err) {
    console.error(`[stock] Yahoo fetch failed for ${symbol}:`, err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase().trim();
  const range  = searchParams.get("range") ?? "1Y";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  // Try live Yahoo Finance first
  const live = await fetchFromYahoo(symbol, range);

  if (live) {
    const metrics  = calculateMetrics(live.historical, live.quote.regularMarketPrice);
    const insights = generateInsights(metrics, symbol);
    return NextResponse.json({ ...live, metrics, insights, demo: false });
  }

  // Fallback: generate realistic demo data so the UI always works
  const demo = getDemoData(symbol, range);
  return NextResponse.json({ ...demo, demo: true });
}
