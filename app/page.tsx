"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useInView,
} from "framer-motion";
import Navbar from "@/components/Navbar";
import TickerTape from "@/components/TickerTape";
import StockSearch from "@/components/StockSearch";
import StockChart from "@/components/StockChart";
import MetricsPanel from "@/components/MetricsPanel";
import AIInsights from "@/components/AIInsights";
import RiskIndicator from "@/components/RiskIndicator";
import WatchlistDrawer from "@/components/WatchlistDrawer";
import TopPicks from "@/components/TopPicks";
import { StockData, TimeRange } from "@/lib/types";
import { prepareChartData } from "@/lib/calculations";

/* ── Background ─────────────────────────────────────────────────────────── */
function Orbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div
        className="orb-1 absolute top-1/4 left-1/5 h-[700px] w-[700px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.045) 0%, transparent 70%)" }}
      />
      <div
        className="orb-2 absolute bottom-1/4 right-1/5 h-[600px] w-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)" }}
      />
      <div
        className="orb-3 absolute top-2/3 left-1/2 h-[400px] w-[400px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

/* ── Scroll-reveal wrapper ───────────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  y = 40,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Staggered grid reveal ───────────────────────────────────────────────── */
function StaggerReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Feature card ────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: "📊", title: "Real Financial Data",  desc: "Live quotes + historical OHLCV from Yahoo Finance — 25+ metrics, no API key needed.",                    color: "from-cyan-500/15 to-blue-500/8",    border: "border-cyan-500/20",  delay: 0 },
  { icon: "🧠", title: "GPT-4o mini Analysis", desc: "Real-time AI explanations of momentum, trend, and risk — written for beginner investors with zero jargon.", color: "from-purple-500/15 to-pink-500/8",  border: "border-purple-500/20", delay: 0.08 },
  { icon: "📈", title: "Interactive Charts",   desc: "Area price chart + volume bars with moving average overlays and smooth tooltips.",                         color: "from-green-500/15 to-teal-500/8",   border: "border-green-500/20",  delay: 0.16 },
  { icon: "⚡", title: "Risk Scoring",         desc: "Volatility, Sharpe ratio, max drawdown and a visual risk meter — all explained in plain English.",          color: "from-orange-500/15 to-yellow-500/8",border: "border-orange-500/20", delay: 0.24 },
];

const PROBLEM_ROWS = [
  { tool: "Bloomberg Terminal", cost: "$24,000/yr", jargon: true,  beginner: false, ai: false },
  { tool: "Robinhood / Webull", cost: "Free",       jargon: true,  beginner: false, ai: false },
  { tool: "ChatGPT (alone)",    cost: "Varies",     jargon: false, beginner: true,  ai: true  },
  { tool: "Quantify AI",       cost: "Free",       jargon: false, beginner: true,  ai: true  },
];

/* ── Loading skeleton ────────────────────────────────────────────────────── */
function Skeleton({ h }: { h: number }) {
  return (
    <div
      className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden relative"
      style={{ height: h }}
    >
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

/* ── Demo banner ─────────────────────────────────────────────────────────── */
function DemoBanner({ reason }: { reason?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/8 px-4 py-3"
    >
      <span className="text-base">⚠️</span>
      <div>
        <p className="text-sm font-semibold text-yellow-300">Demo mode — live market data is currently unreachable</p>
        <p className="text-xs text-yellow-600 mt-0.5">Showing simulated data so you can explore all features. Real data will load when the connection is restored.</p>
        {reason && <p className="text-[10px] text-yellow-700/80 mt-1 break-all">Details: {reason}</p>}
      </div>
    </motion.div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function Home() {
  const [data,           setData]          = useState<StockData | null>(null);
  const [loading,        setLoading]       = useState(false);
  const [error,          setError]         = useState<string | null>(null);
  const [suggestions,    setSuggestions]   = useState<{ symbol: string; name: string }[]>([]);
  const [currentSymbol,  setCurrentSymbol] = useState("");
  const [selectedRange,  setSelectedRange] = useState<TimeRange>("1Y");
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-search when coming from dashboard
  useEffect(() => {
    const sym = sessionStorage.getItem("quantify_autosearch");
    if (sym) {
      sessionStorage.removeItem("quantify_autosearch");
      handleSearch(sym, "1Y");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { scrollYProgress } = useScroll();
  const heroScale   = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0.6]);

  const handleSearch = useCallback(async (symbol: string, range: TimeRange) => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setCurrentSymbol(symbol);
    setSelectedRange(range);
    setData(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(
        `/api/stock?symbol=${encodeURIComponent(symbol)}&range=${range}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      let json: StockData & { demo?: boolean };
      try {
        json = await res.json();
      } catch {
        setError("Server returned an unexpected response. Please try again.");
        return;
      }

      if (!res.ok) {
        const body = json as { error?: string; suggestions?: { symbol: string; name: string }[] };
        setError(body.error || `Could not find "${symbol}". Check the ticker and try again.`);
        setSuggestions(body.suggestions ?? []);
        return;
      }

      setData(json);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Request timed out. Check your internet connection and try again.");
      } else {
        setError(
          'Cannot reach the server — run  npm run dev  in your project folder, then reload this page.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const chartData = data ? prepareChartData(data.historical, data.metrics) : [];

  return (
    <div className="min-h-screen bg-[#04060f] text-slate-100 overflow-x-hidden">
      <Orbs />
      <Navbar />
      <WatchlistDrawer onSelect={(sym) => handleSearch(sym, "1Y")} />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <motion.section
        style={{ scale: heroScale, opacity: heroOpacity, willChange: "transform, opacity" }}
        className="relative min-h-screen flex flex-col justify-center pt-20"
      >
        <div className="absolute top-20 left-0 right-0">
          <TickerTape />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 pt-28 pb-20 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-400 mb-8"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            AI-Powered Stock Research · Free · No API Key Required
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-4"
          >
            <span className="text-white">Smart </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
              Investment
            </span>
            <br />
            <span className="text-white">Research</span>
          </motion.h1>

          {/* Underline accent */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="h-0.5 w-48 mx-auto mt-1 mb-8 origin-center bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Real-time charts, GPT-4o mini analysis, and risk scoring explained in plain English —
            built for first-time investors who can&apos;t afford a financial advisor.
          </motion.p>

          <StockSearch onSearch={handleSearch} loading={loading} />

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ duration: 0.3 }}
                className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3 text-left"
              >
                <svg className="h-5 w-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-300">{error}</p>
                  {suggestions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-red-400/80">Did you mean:</span>
                      {suggestions.map((sug) => (
                        <button
                          key={sug.symbol}
                          type="button"
                          onClick={() => handleSearch(sug.symbol, selectedRange)}
                          className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-300 hover:bg-cyan-500/20"
                        >
                          <span className="font-bold">{sug.symbol}</span>
                          <span className="text-cyan-500/80"> · {sug.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-red-500/70 mt-1">Try: AAPL · TSLA · NVDA · MSFT · GOOGL · SPY</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <TopPicks onSelect={(sym) => handleSearch(sym, "1Y")} />
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-700"
        >
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <div className="bob h-6 w-px bg-gradient-to-b from-slate-600 to-transparent" />
        </motion.div>
      </motion.section>

      {/* ── Analysis results ───────────────────────────────────────────── */}
      <div ref={resultsRef} className="relative mx-auto max-w-7xl px-6 pb-32">

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  className="h-5 w-5 rounded-full border-2 border-cyan-500 border-t-transparent"
                />
                <span className="text-sm text-slate-400">
                  Analyzing <span className="text-cyan-400 font-bold">{currentSymbol}</span>
                  <motion.span animate={{ opacity: [0,1,0] }} transition={{ duration: 1.2, repeat: Infinity }}>…</motion.span>
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Skeleton h={380} />
                  <Skeleton h={460} />
                </div>
                <div className="space-y-5">
                  <Skeleton h={200} />
                  <Skeleton h={280} />
                  <Skeleton h={200} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence mode="wait">
          {data && !loading && (
            <motion.div
              key={currentSymbol}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {data.demo && <DemoBanner reason={data.demoReason} />}

              {/* Divider */}
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-xs text-slate-600 uppercase tracking-widest font-medium px-3 py-1 rounded-full border border-white/8"
                >
                  Analysis · {currentSymbol}
                </motion.span>
                <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left col */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Chart — slides in from left */}
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <StockChart
                      data={chartData}
                      symbol={currentSymbol}
                      totalReturn={data.metrics.totalReturn}
                      currentPrice={data.quote.regularMarketPrice}
                    />
                  </motion.div>

                  {/* AI insights — scroll reveal */}
                  <Reveal delay={0.05} y={50}>
                    <AIInsights
                      insights={data.insights}
                      metrics={data.metrics}
                      quote={data.quote}
                      symbol={currentSymbol}
                      companyName={data.quote.shortName}
                      range={selectedRange}
                    />
                  </Reveal>
                </div>

                {/* Right col — slides in from right */}
                <div className="space-y-5">
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <RiskIndicator metrics={data.metrics} />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <MetricsPanel quote={data.quote} metrics={data.metrics} />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Empty / feature showcase ──────────────────────────────── */}
        {!data && !loading && (
          <div>
            <Reveal delay={0.3} className="text-center mb-12">
              <h2 className="text-3xl font-black text-white mb-3">
                Everything you need to{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                  research stocks
                </span>
              </h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Real market data · AI analysis · No signup · No API key
              </p>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map(({ icon, title, desc, color, border, delay }) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 40, scale: 0.92 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className={`rounded-2xl border ${border} bg-gradient-to-br ${color} p-5 cursor-default transition-shadow hover:shadow-lg hover:shadow-cyan-500/10`}
                >
                  <span className="text-3xl block mb-3">{icon}</span>
                  <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Stats */}
            <Reveal delay={0.2} className="mt-12">
              <StaggerReveal className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
                {[
                  { val: "25+", label: "Metrics" },
                  { val: "6",   label: "Time Ranges" },
                  { val: "Free",label: "Always" },
                ].map(({ val, label }) => (
                  <motion.div
                    key={label}
                    variants={{
                      hidden: { opacity: 0, scale: 0.7 },
                      show:   { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200, damping: 18 } },
                    }}
                    whileHover={{ scale: 1.08 }}
                    className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{val}</p>
                    <p className="text-xs text-slate-500 mt-1">{label}</p>
                  </motion.div>
                ))}
              </StaggerReveal>
            </Reveal>

            {/* ── Community Impact ───────────────────────────────── */}
            <Reveal delay={0.1} className="mt-24">
              <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-blue-500/5 p-8 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400 mb-5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Community Impact
                </motion.div>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
                  Built for the{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    50M+ Americans
                  </span>
                  <br />who want to invest — but don&apos;t know where to start
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed mb-8">
                  First-time retail investors aged 18–30 face a real barrier: financial advisors charge
                  $250–400/hr and require $100K+ minimums. Social media is their only alternative — and
                  83% of Gen Z already rely on it for financial advice (FINRA 2023). We&apos;re changing that.
                </p>
                <StaggerReveal className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  {[
                    { stat: "83%",   desc: "of Gen Z use social media for financial guidance (FINRA 2023)" },
                    { stat: "$385",  desc: "average hourly cost of a financial advisor — out of reach for most beginners" },
                    { stat: "0",     desc: "cost to use Quantify AI — real data, plain English, no paywall" },
                  ].map(({ stat, desc }) => (
                    <motion.div
                      key={stat}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
                      }}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-5"
                    >
                      <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">{stat}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                    </motion.div>
                  ))}
                </StaggerReveal>
              </div>
            </Reveal>

            {/* ── Why existing tools fail ────────────────────────── */}
            <Reveal delay={0.1} className="mt-12">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8">
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-400 mb-4"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                    Originality
                  </motion.div>
                  <h2 className="text-2xl font-black text-white mb-2">Why existing tools fail beginners</h2>
                  <p className="text-slate-500 text-sm max-w-lg mx-auto">
                    Quantify AI is the only tool that combines live market data with AI-generated plain-English explanations — free, for everyone.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-white/8">
                        <th className="pb-3 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tool</th>
                        <th className="pb-3 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                        <th className="pb-3 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Beginner-friendly</th>
                        <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Real-time AI explanation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {PROBLEM_ROWS.map(({ tool, cost, jargon, beginner, ai }, i) => (
                        <motion.tr
                          key={tool}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.08 }}
                          className={tool === "Quantify AI" ? "bg-cyan-500/5 rounded-lg" : ""}
                        >
                          <td className={`py-3.5 pr-6 font-semibold ${tool === "Quantify AI" ? "text-cyan-400" : "text-slate-300"}`}>{tool}</td>
                          <td className="py-3.5 pr-6 text-slate-400">{cost}</td>
                          <td className="py-3.5 pr-6">
                            {beginner
                              ? <span className="text-green-400 font-bold">Yes</span>
                              : <span className="text-red-400">No — jargon-heavy</span>}
                          </td>
                          <td className="py-3.5">
                            {ai
                              ? <span className="inline-flex items-center gap-1 text-green-400 font-bold"><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />Yes</span>
                              : <span className="text-slate-600">No</span>}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="border-t border-white/6 bg-white/[0.015] py-8"
      >
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <span className="font-semibold text-slate-500">Quantify AI</span>
          </div>
          <p>Data from Yahoo Finance · For educational use only · Not financial advice</p>
          <p>Next.js · Tailwind · Framer Motion · Netlify</p>
        </div>
      </motion.footer>
    </div>
  );
}
