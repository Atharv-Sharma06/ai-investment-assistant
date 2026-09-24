// Historical price data with multiple fallback sources.
//
// Yahoo often blocks requests from cloud/serverless IPs (Netlify runs on AWS),
// so each source is tried in order until one returns data:
//   - yahoo-finance2 chart()        (query2.finance.yahoo.com)
//   - Yahoo chart API, direct fetch (query1.finance.yahoo.com)
//   - Stooq CSV                     (no key, US tickers only)
//   - Twelve Data                   (only if TWELVE_DATA_API_KEY is set)
// Every failure reason is collected so the caller can log/report it.

import { HistoricalDataPoint } from "./types";
import { getYahooClient, withTimeout } from "./yahoo";

export type Interval = "1d" | "1wk";

export interface HistoryResult {
  historical: HistoricalDataPoint[];
  meta: Record<string, unknown>;
  source: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const SOURCE_TIMEOUT_MS = 4000;

const toDate = (d: Date) => d.toISOString().split("T")[0];
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/* ── 1. yahoo-finance2 ─────────────────────────────────────────────────── */
async function fromYahooLib(symbol: string, period1: Date, interval: Interval): Promise<HistoryResult> {
  const chart = await getYahooClient().chart(symbol, { period1, interval });
  const historical: HistoricalDataPoint[] = (chart?.quotes ?? [])
    .filter((d) => isNum(d["close"]))
    .map((d) => {
      const num = (f: string, fb: number) => (isNum(d[f]) ? (d[f] as number) : fb);
      const close = d["close"] as number;
      const dateVal = d["date"];
      return {
        date: dateVal instanceof Date ? toDate(dateVal) : String(dateVal).split("T")[0],
        open: num("open", close),
        high: num("high", close),
        low: num("low", close),
        close,
        volume: num("volume", 0),
        adjClose: num("adjclose", close),
      };
    });
  return { historical, meta: (chart?.meta ?? {}) as Record<string, unknown>, source: "yahoo" };
}

/* ── 2. Yahoo chart API, direct ────────────────────────────────────────── */
async function fromYahooDirect(symbol: string, period1: Date, interval: Interval): Promise<HistoryResult> {
  const p1 = Math.floor(period1.getTime() / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${p1}&period2=${p2}&interval=${interval}&includeAdjustedClose=true`;
  const res = await fetchWithTimeout(url, SOURCE_TIMEOUT_MS, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description ?? "empty chart result");

  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const adj: (number | null)[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const historical: HistoricalDataPoint[] = [];
  ts.forEach((t, i) => {
    const close = q.close?.[i];
    if (!isNum(close)) return;
    historical.push({
      date: toDate(new Date(t * 1000)),
      open: isNum(q.open?.[i]) ? q.open[i] : close,
      high: isNum(q.high?.[i]) ? q.high[i] : close,
      low: isNum(q.low?.[i]) ? q.low[i] : close,
      close,
      volume: isNum(q.volume?.[i]) ? q.volume[i] : 0,
      adjClose: isNum(adj[i]) ? (adj[i] as number) : close,
    });
  });
  return { historical, meta: result.meta ?? {}, source: "yahoo-direct" };
}

/* ── 3. Twelve Data (free API key: https://twelvedata.com) ─────────────── */
async function fromTwelveData(symbol: string, days: number, interval: Interval): Promise<HistoryResult> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error("TWELVE_DATA_API_KEY not set");
  const outputsize = Math.min(5000, interval === "1wk" ? Math.ceil(days / 7) + 2 : Math.ceil(days * 0.7) + 5);
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${interval === "1wk" ? "1week" : "1day"}&outputsize=${outputsize}&apikey=${key}`;
  const res = await fetchWithTimeout(url, SOURCE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json?.status !== "ok" || !Array.isArray(json.values)) {
    throw new Error(json?.message ?? "unexpected response");
  }
  const historical: HistoricalDataPoint[] = (json.values as Record<string, string>[])
    .map((v) => {
      const close = parseFloat(v.close);
      return {
        date: String(v.datetime).split(" ")[0],
        open: parseFloat(v.open) || close,
        high: parseFloat(v.high) || close,
        low: parseFloat(v.low) || close,
        close,
        volume: parseFloat(v.volume) || 0,
        adjClose: close,
      };
    })
    .filter((d) => isNum(d.close))
    .reverse(); // Twelve Data returns newest first
  return { historical, meta: { symbol: json.meta?.symbol }, source: "twelvedata" };
}

/* ── 4. Stooq CSV (no key) ─────────────────────────────────────────────── */
async function fromStooq(symbol: string, period1: Date, interval: Interval): Promise<HistoryResult> {
  // Stooq uses "<ticker>.us" for US listings; skip anything that isn't a plain US ticker.
  if (!/^[A-Z][A-Z0-9-]{0,9}$/.test(symbol)) throw new Error("unsupported symbol for Stooq");
  const d1 = toDate(period1).replace(/-/g, "");
  const d2 = toDate(new Date()).replace(/-/g, "");
  const url =
    `https://stooq.com/q/d/l/?s=${symbol.toLowerCase().replace(/-/g, ".")}.us` +
    `&i=${interval === "1wk" ? "w" : "d"}&d1=${d1}&d2=${d2}`;
  const res = await fetchWithTimeout(url, SOURCE_TIMEOUT_MS, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = (await res.text()).trim();
  const lines = text.split(/\r?\n/);
  if (!/^Date,Open,High,Low,Close/i.test(lines[0] ?? "")) {
    throw new Error(`unexpected response: ${text.slice(0, 80)}`);
  }
  const historical: HistoricalDataPoint[] = lines
    .slice(1)
    .map((line) => {
      const [date, open, high, low, close, volume] = line.split(",");
      const c = parseFloat(close);
      return {
        date,
        open: parseFloat(open) || c,
        high: parseFloat(high) || c,
        low: parseFloat(low) || c,
        close: c,
        volume: parseFloat(volume) || 0,
        adjClose: c,
      };
    })
    .filter((d) => d.date && isNum(d.close));
  return { historical, meta: {}, source: "stooq" };
}

async function attempt(
  name: string,
  load: () => Promise<HistoryResult>
): Promise<{ result: HistoryResult | null; error: string | null }> {
  try {
    const result = await withTimeout(load(), SOURCE_TIMEOUT_MS);
    return result.historical.length > 0
      ? { result, error: null }
      : { result: null, error: `${name}: no data` };
  } catch (err) {
    return { result: null, error: `${name}: ${errMsg(err)}` };
  }
}

export async function fetchHistory(
  symbol: string,
  days: number,
  interval: Interval,
  { allowKeyed = true }: { allowKeyed?: boolean } = {}
): Promise<{ result: HistoryResult | null; errors: string[] }> {
  const period1 = new Date();
  period1.setDate(period1.getDate() - days);

  // Free, keyless sources run in parallel (Netlify functions time out at 10s);
  // the first one in priority order that returns data wins.
  const free = await Promise.all([
    attempt("yahoo", () => fromYahooLib(symbol, period1, interval)),
    attempt("yahoo-direct", () => fromYahooDirect(symbol, period1, interval)),
    attempt("stooq", () => fromStooq(symbol, period1, interval)),
  ]);
  const errors = free.flatMap((r) => (r.error ? [r.error] : []));
  const hit = free.find((r) => r.result);
  if (hit?.result) return { result: hit.result, errors };

  // Keyed source last, so its daily quota is only spent when needed.
  if (allowKeyed && process.env.TWELVE_DATA_API_KEY) {
    const td = await attempt("twelvedata", () => fromTwelveData(symbol, days, interval));
    if (td.result) return { result: td.result, errors };
    if (td.error) errors.push(td.error);
  }
  return { result: null, errors };
}
