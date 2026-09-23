import { NextRequest, NextResponse } from "next/server";
import { getYahooClient, withTimeout } from "@/lib/yahoo";

export const runtime = "nodejs";

const FALLBACK_NEWS = [
  {
    title: "AI Chip Demand Drives Tech Sector to New Record Highs",
    publisher: "Market Watch",
    url: "#",
    publishedAt: Date.now() - 1_800_000,
    thumbnail: null,
  },
  {
    title: "Federal Reserve Signals Patience on Rate Cuts; Markets Steady",
    publisher: "Reuters",
    url: "#",
    publishedAt: Date.now() - 7_200_000,
    thumbnail: null,
  },
  {
    title: "NVIDIA, Microsoft Lead Big Tech Rally on Strong Earnings Beats",
    publisher: "Bloomberg",
    url: "#",
    publishedAt: Date.now() - 14_400_000,
    thumbnail: null,
  },
  {
    title: "S&P 500 Notches Sixth Consecutive Week of Gains as Sentiment Improves",
    publisher: "CNBC",
    url: "#",
    publishedAt: Date.now() - 28_800_000,
    thumbnail: null,
  },
  {
    title: "Consumer Spending Beats Estimates; Retail Stocks Surge Pre-Market",
    publisher: "Wall Street Journal",
    url: "#",
    publishedAt: Date.now() - 43_200_000,
    thumbnail: null,
  },
  {
    title: "Options Market Signals Low Volatility Ahead; Analysts Cautiously Optimistic",
    publisher: "Barron's",
    url: "#",
    publishedAt: Date.now() - 86_400_000,
    thumbnail: null,
  },
];

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "SPY";

  try {
    const results = await withTimeout(
      getYahooClient().search(symbol, { newsCount: 6 }),
      4000
    ) as Record<string, unknown> | null;

    const rawNews = results?.news as Array<Record<string, unknown>> | undefined;
    if (rawNews && rawNews.length > 0) {
      const news = rawNews.slice(0, 6).map((item) => ({
        title: item.title as string,
        publisher: item.publisher as string,
        url: (item.link as string) ?? "#",
        publishedAt: ((item.providerPublishTime as number) ?? 0) * 1000,
        thumbnail:
          (item.thumbnail as { resolutions?: Array<{ url: string }> } | undefined)
            ?.resolutions?.[0]?.url ?? null,
      }));
      return NextResponse.json({ news, live: true });
    }
  } catch (err) {
    console.warn(`[news] Yahoo search failed for ${symbol}:`, err);
  }

  return NextResponse.json({ news: FALLBACK_NEWS, live: false });
}
