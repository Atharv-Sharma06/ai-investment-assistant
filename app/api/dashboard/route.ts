import { NextResponse } from "next/server";
import { getDemoData } from "@/lib/demoData";
import { getChartPrice } from "@/lib/yahoo";

export const runtime = "nodejs";

const TICKERS = ["NVDA", "MSFT", "AAPL", "META", "GOOGL", "AMZN", "TSLA", "SPY", "AMD", "QQQ"];

async function getLiveQuote(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    // Uses the chart endpoint, which (unlike quote()) doesn't need Yahoo's
    // cookie/crumb handshake that is often blocked on serverless hosts.
    return await getChartPrice(symbol, 4000);
  } catch (err) {
    console.warn(`[dashboard] live price failed for ${symbol}:`, err);
    return null;
  }
}

export async function GET() {
  const results = await Promise.all(
    TICKERS.map(async (symbol) => {
      const data = getDemoData(symbol, "1Y");
      const { quote, metrics, insights } = data;
      const live = await getLiveQuote(symbol);
      return {
        symbol,
        name: quote.shortName,
        sector: quote.sector ?? "Technology",
        price: live?.price ?? quote.regularMarketPrice,
        change: live?.change ?? quote.regularMarketChangePercent,
        score: insights.score,
        confidence: insights.confidence,
        trend: metrics.trendDirection,
        volatility: parseFloat(metrics.volatility.toFixed(1)),
        riskLevel: (metrics.volatility > 30 ? "high" : metrics.volatility > 20 ? "medium" : "low") as "low" | "medium" | "high",
        sharpe: parseFloat(metrics.sharpeRatio.toFixed(2)),
        totalReturn: parseFloat(metrics.totalReturn.toFixed(1)),
        livePrice: !!live,
      };
    })
  );

  results.sort((a, b) => b.score - a.score);
  return NextResponse.json({ stocks: results });
}
