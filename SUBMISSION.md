# AI x STEM Impact Fest — Hackathon Submission

## Project: Quantify AI
**Live Demo:** https://quantifyai-by-as.netlify.app
**GitHub:** https://github.com/atharv-sharma06/ai-investment-assistant

---

## Write-Up

**Who are you helping?**
High school and college students (ages 16–22) who want to start investing but lack access to financial advisors or professional tools. According to FINRA, only 24% of young adults demonstrate basic financial literacy, yet over half say they want to invest and don't know how to start. This is the gap Quantify AI fills.

**What problem are you solving?**
Existing platforms like Yahoo Finance display raw data without explanation. Generic AI chatbots give advice without grounding it in real numbers. Financial advisors are expensive and inaccessible to students. Quantify AI bridges this gap — combining live quantitative analysis with GPT-generated plain-English explanations written for someone investing for the first time.

**How does the AI work?**
Quantify AI uses a two-layer system. First, a custom rule-based engine fetches live stock data via the Yahoo Finance API and computes an attractiveness score (0–100) using volatility, 52-week positioning, price momentum, and trend direction — real quantitative finance metrics. Second, that scored data is passed to GPT-4o mini, which generates human-readable breakdowns of momentum, risk, and trend, plus a direct "Should I Invest?" answer. If no API key is present, the app falls back to the rule-based engine — it always works.

**What STEM domain is involved?**
Quantitative finance and computer science. The scoring algorithm applies real financial indicators used by professional analysts. The system integrates live market data pipelines, a React/Next.js frontend, and a large language model — demonstrating full-stack AI engineering.

**What are the current limits?**
- Educational use only — not a substitute for licensed financial advice
- GPT insights require an API key; rule-based fallback activates otherwise
- No portfolio simulation or historical backtesting yet
- News sentiment is fetched but not yet weighted into the score

---

## Team Roster
<!-- Fill in below -->
| Name | Grade / Year | School |
|------|-------------|--------|
|      |             |        |

## Selected Track
<!-- Fill in the track name -->

## Demo Video
<!-- Paste your 3-minute video link here -->
