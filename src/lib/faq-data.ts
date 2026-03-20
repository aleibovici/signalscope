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
      "SignalScope monitors seven data sources on every scan: Reddit (17 subreddits), X/Twitter, StockTwits, SEC insider filings (C-suite purchases over $50K), congressional stock trades (STOCK Act disclosures), options flow (unusual call volume), and volume spikes (2x+ average). Raw mentions are aggregated by ticker symbol, scored by AI, filtered for pump-and-dump schemes, and assigned to stages based on conviction level.",
  },
  {
    question: "What do signal stages (Emerging, Building, Consensus, Filtered) mean?",
    answer:
      "Emerging signals have a score of 40+ with multiple sources or a novel ticker — this is the earliest detection point with the highest alpha potential. Building signals have a score of 45-50+ with velocity or multi-source confirmation — momentum is growing but the move may have started. Consensus signals have a score of 65-70+ with broad, fresh social agreement — but stale consensus is excluded because the move may be priced in. Filtered signals failed the pump-and-dump check and are quarantined.",
  },
  {
    question: "How does AI scoring work?",
    answer:
      "Each candidate ticker is scored by AI (GPT-4o or Claude) on a 0-100 scale based on source weights, catalyst quality, novelty, and cross-source corroboration. Pure social signals (Reddit/StockTwits/Twitter only) are hard-capped at 50 regardless of the AI score — only tickers with verifiable catalyst sources like SEC insider filings or congressional trades can score above 50. First-appearance tickers get a novelty boost; stale tickers get a penalty.",
  },
  {
    question: "What is the difference between Opportunity Score and Signal Confidence?",
    answer:
      "These are two independent 0-100 metrics measuring different things. Opportunity Score ranks how favorable the timing and setup are for catching a move early — it is the primary sort metric on the dashboard. Signal Confidence (AI score) measures how strong the evidence is across sources. A very high confidence score often means broad market agreement, and by that point more of the move may already be priced in. Use Opportunity when you care about being early; use Confidence when you care about how well-supported the thesis is.",
  },
  {
    question: "How does the pump-and-dump filter work?",
    answer:
      "Every candidate is checked against 13 statistical flags covering price characteristics (penny stocks, OTC listings), social manipulation patterns (coordinated posts, hyperbolic language, upvote pumping), source quality (single source, no news catalyst), and timing anomalies (sudden spikes, bot promoters). Three or more flags immediately quarantine a ticker. Exactly two flags triggers an AI edge-case review. This catches the vast majority of pump-and-dump schemes before they reach the dashboard.",
  },
  {
    question: "What sources does SignalScope monitor?",
    answer:
      "Seven sources, each with a weight reflecting its predictive value: SEC Insider filings (3.0x weight — C-suite purchases over $50K), Options Flow (2.5x — unusual call volume and sweeps), Congressional trades (2.5x — STOCK Act disclosures), Volume Spikes (2.0x — stocks at 2x+ average volume), X/Twitter (1.2x — API v2 keyword search), Reddit (1.0x — 17 subreddits), and StockTwits (1.0x — trending tickers).",
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
      "Signal harvesting runs once daily, approximately 30 minutes before US market open. Price snapshots are collected twice daily — at market open (9:30 AM ET) and close (4:05 PM ET). Returns are computed at 1, 3, 7, and 30 days after detection with tolerance windows that handle weekends and holidays. AI reports for the top emerging tickers are pre-generated after each harvest.",
  },
  {
    question: "Is SignalScope free?",
    answer:
      "Yes — creating an account and using the dashboard is free with no credit card required. The platform is free for retail investors and traders. AI agents can also access data without an account via x402 micropayments (from $0.005 per call). There are no subscription tiers or premium features behind a paywall.",
  },
  {
    question: "How is signal performance tracked?",
    answer:
      "Automated price snapshots at market open and close track every validated ticker for 30 days after detection. Returns are measured at 1, 3, 7, and 30 days using nominal prices. Tickers that undergo corporate actions (reverse splits, forward splits, mergers) during the tracking window are automatically detected and excluded from performance statistics to prevent misleading returns. This data feeds into an XGBoost machine learning model that uses SHAP analysis to identify which signal features predict real-world outcomes, continuously refining scoring thresholds, stage assignments, and filtering logic.",
  },
  {
    question: "What does Filtered mean?",
    answer:
      "Filtered tickers failed the pump-and-dump check — they triggered 3 or more of the 13 statistical flags (or 2 flags plus a confirming AI assessment). These tickers are quarantined from the main dashboard and visible in a dedicated Filtered tab. They are not deleted — you can still view the raw signals and understand why they were flagged. Filtering protects users from acting on potentially manipulated signals.",
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
