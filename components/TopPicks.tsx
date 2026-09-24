"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Pick {
  symbol: string;
  name: string;
  price: number;
  change: number;
  score: number;
  trend: "bullish" | "bearish" | "neutral";
  riskLevel: "low" | "medium" | "high";
  livePrice: boolean;
}

interface Props {
  onSelect: (symbol: string) => void;
}

const TREND_COLOR = { bullish: "text-green-400", bearish: "text-red-400", neutral: "text-yellow-400" };
const RISK_COLOR = { low: "text-green-400", medium: "text-yellow-400", high: "text-red-400" };

function scoreColor(score: number) {
  return score >= 70 ? "text-cyan-400" : score >= 50 ? "text-orange-400" : "text-red-400";
}

/** Top 5 companies by attractiveness score, from /api/dashboard. */
export default function TopPicks({ onSelect }: Props) {
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: { stocks?: Pick[] }) => {
        const top = [...(d.stocks ?? [])].sort((a, b) => b.score - a.score).slice(0, 5);
        setPicks(top);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed || (picks && picks.length === 0)) return null;

  const allLive = !!picks && picks.every((p) => p.livePrice);

  return (
    <section className="mt-10 text-left">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">🏆 Top 5 by Score</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked by momentum, trend, risk-adjusted return and volatility. Tap one to analyze it.
          </p>
        </div>
        {picks && !allLive && (
          <span className="shrink-0 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400">
            Some scores use demo data
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {(picks ?? Array.from({ length: 5 }, () => null)).map((p, i) =>
          p ? (
            <motion.button
              key={p.symbol}
              type="button"
              onClick={() => onSelect(p.symbol)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-left hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">#{i + 1}</span>
                <span className={`text-lg font-black ${scoreColor(p.score)}`}>{p.score}</span>
              </div>
              <p className="text-sm font-bold text-white">{p.symbol}</p>
              <p className="truncate text-[11px] text-slate-500">{p.name}</p>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-300">${p.price.toFixed(2)}</span>
                <span className={p.change >= 0 ? "text-green-400" : "text-red-400"}>
                  {p.change >= 0 ? "+" : ""}{p.change.toFixed(2)}%
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className={`capitalize ${TREND_COLOR[p.trend]}`}>{p.trend}</span>
                <span className={RISK_COLOR[p.riskLevel]}>{p.riskLevel} risk</span>
              </div>
            </motion.button>
          ) : (
            <div key={i} className="h-[118px] animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
          )
        )}
      </div>
    </section>
  );
}
