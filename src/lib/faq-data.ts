export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    question: "What are stock breakout signals?",
    answer:
      "Breakout signals are early indicators that a stock may be about to make a significant price move. They come from multiple sources: social media discussions gaining traction, SEC insider purchases, congressional stock trades, unusual options activity, and volume spikes. When multiple independent sources converge on the same ticker, the probability of a real catalyst rises significantly.",
  },
  {
    question: "How does SignalScope detect signals?",
    answer:
      "SignalScope monitors eight data sources on every scan: Reddit (17 subreddits), X/Twitter, StockTwits, SEC insider filings (C-suite purchases over $50K), congressional stock trades (STOCK Act disclosures), options flow (unusual call volume), volume spikes (2x+ average), and Polymarket prediction markets (active price and catalyst markets with meaningful trading volume). Raw mentions are aggregated by ticker symbol, scored by AI, filtered for pump-and-dump schemes, and assigned to stages based on conviction level.",
  },
  {
    question: "What do signal stages (Emerging, Building, Consensus, Filtered) mean?",
    answer:
      "Emerging signals have a score of 40+ with multiple sources or a novel ticker — this is the earliest detection point with the highest alpha potential. Building signals have a score of 45-50+ with velocity or multi-source confirmation — momentum is growing but the move may have started. Consensus signals have a score of 65-70+ with broad, fresh social agreement — but stale consensus is excluded because the move may be priced in. Filtered signals failed the pump-and-dump check and are quarantined.",
  },
  {
    question: "How does AI scoring work?",
    answer:
      "Each candidate ticker is scored by AI on a 0-100 scale using configurable LLM providers (OpenAI or Anthropic) based on source weights, catalyst quality, novelty, and cross-source corroboration. Pure social signals (Reddit/StockTwits/Twitter only) are hard-capped at 50 regardless of the AI score — only tickers with verifiable catalyst sources (SEC insider filings, congressional trades, or unusual options flow) can score above 50. First-appearance tickers get a novelty boost; stale tickers get a penalty.",
  },
  {
    question: "What is the difference between Opportunity Score and Signal Confidence?",
    answer:
      "These are two independent 0-100 metrics measuring different things. Opportunity Score ranks how favorable the timing and setup are for catching a move early — it is the primary sort metric on the dashboard. Signal Confidence (AI score) measures how strong the evidence is across sources. A very high confidence score often means broad market agreement, and by that point more of the move may already be priced in. Use Opportunity when you care about being early; use Confidence when you care about how well-supported the thesis is.",
  },
  {
    question: "How does the pump-and-dump filter work?",
    answer:
      "Every candidate is checked against 13 statistical flags. Seven are 'effective' flags that count toward the quarantine threshold — these are ML-validated bearish predictors: micro-cap with no catalyst (−4.7% avg 7d return), sudden spike (−4.1%), penny-only subreddits, sub-dime 52-week floor, upvote pumping, hyperbolic language, and Twitter bot promoters. Six are 'informational' flags stored for analysis but excluded from the threshold because ML backtesting shows they predict neutral or positive returns: penny price (+1.4% avg 7d), OTC listing (+0.5%), no news catalyst, Twitter coordinated pump, coordinated posts, and single source. Three or more effective flags immediately quarantine a ticker. Exactly two effective flags triggers an AI edge-case review.",
  },
  {
    question: "What sources does SignalScope monitor?",
    answer:
      "Eight sources, each with a weight reflecting its predictive value: SEC Insider filings (3.0x weight — C-suite purchases over $50K), Options Flow (2.5x — unusual call volume and sweeps), Congressional trades (2.5x — STOCK Act disclosures), Volume Spikes (2.5x — stocks at 2x+ average volume), Polymarket (2.0x — active prediction markets for price targets and catalyst events), X/Twitter (1.2x — API v2 keyword search), Reddit (1.0x — 17 subreddits), and StockTwits (1.0x — trending tickers). Polymarket is unique in that it also runs a second scan pass specifically for any new tickers discovered by other sources during the same harvest run.",
  },
  {
    question: "What is x402 and how do AI agents pay for data?",
    answer:
      "The x402 protocol adds a payment layer to HTTP. When an AI agent hits a monetized endpoint without credentials, it receives an HTTP 402 response with payment details. The agent pays in USDC on Base (L2, near-zero gas), attaches the payment proof, and retries to receive data. No registration or API key needed. Prices range from $0.005 per data call to $0.05 for AI-generated reports. The search endpoint is free for ticker discovery.",
  },
  {
    question: "How do I get API access?",
    answer:
      "Two options: (1) x402 micropayments — no registration needed, pay per call in USDC on Base. Any AI agent with a USDC wallet can start immediately. (2) API key — register for a free account, then generate a key from your Profile page. API keys give access to all endpoints including portfolio management, watchlists, and performance tracking. Keys use the format sk_sig_ followed by 48 hex characters.",
  },
  {
    question: "How fresh is the data and how often is it updated?",
    answer:
      "Signal harvesting runs once daily at 8:30 AM ET on weekdays — approximately one hour before US market open. Price snapshots are collected three times daily: at 9:45 AM ET (15 min after open, avoiding auction volatility), 12:30 PM ET (midday), and 4:05 PM ET (after close). Returns are computed at 1, 3, 7, 14, and 30 days after detection with tolerance windows that handle weekends and holidays. AI reports for the top emerging tickers are pre-generated after each harvest.",
  },
  {
    question: "Is SignalScope free?",
    answer:
      "Yes. Register for a free account to browse signals, trending tickers, portfolio tracking, watchlists, API keys, on-demand AI reports, and email alerts. AI agents can also access data without an account via x402 micropayments (from $0.005 per call) — no registration needed. Optional Stripe billing can be enabled by self-hosters who configure STRIPE_* environment variables.",
  },
  {
    question: "How is signal performance tracked?",
    answer:
      "Automated price snapshots three times daily track every validated ticker for 30 days after detection. Returns are measured at 1, 3, 7, 14, and 30 days using nominal prices. Tickers that undergo corporate actions (reverse splits, forward splits, mergers) during the tracking window are automatically detected and excluded from performance statistics to prevent misleading returns. This data feeds into an external ML backtesting harness (pure LightGBM on 3-day forward returns, 308 features) that uses feature importance and information coefficient analysis to identify which signal features predict real-world outcomes, continuously refining scoring thresholds, stage assignments, and filtering logic.",
  },
  {
    question: "What does Filtered mean?",
    answer:
      "Filtered tickers failed the pump-and-dump check — they triggered 3 or more effective bearish flags (or exactly 2 effective flags plus a confirming AI assessment). Note that not all 13 flags count toward filtering: penny price, OTC listing, no news catalyst, Twitter coordinated pump, coordinated posts, and single source are informational flags that don't trigger quarantine because ML data shows they predict neutral or positive returns. Filtered tickers are quarantined from the main dashboard but visible in a dedicated Filtered tab — you can still view the raw signals and understand why they were flagged.",
  },
  {
    question: "Can I track my portfolio?",
    answer:
      "Yes. The dashboard includes a portfolio tracker where you can add positions with entry price, quantity, and date. The system tracks performance against active signals, showing how your holdings relate to detected breakout signals. Portfolio endpoints are available via API key for programmatic access from AI agents and trading tools.",
  },
  {
    question: "Is this financial advice?",
    answer:
      "No. SignalScope is a research tool for informational purposes only. It detects and scores signals from public data sources, but does not recommend specific trades or guarantee returns. All investments carry risk. Always do your own due diligence before making investment decisions. Past signal performance does not guarantee future results.",
  },
];
