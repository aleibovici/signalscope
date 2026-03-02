export const TICKER_REGEX = /\b([A-Z]{1,5})\b/g;

// Common English words that look like tickers
export const BLACKLIST = new Set([
  // Single/two-letter words
  "A", "I", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "IF", "IN",
  "IS", "IT", "ME", "MY", "NO", "OF", "OK", "ON", "OR", "SO", "TO", "UP",
  "US", "WE", "DD", "TA", "PE", "SP",
  // Financial acronyms & market terms
  "CEO", "IPO", "ETF", "SEC", "FBI", "FDA", "IMO", "YOLO", "FOMO",
  "EPS", "GDP", "CPI", "ATH", "ATL", "OTC", "NYSE", "NASDAQ",
  "USD", "EUR", "GBP", "JPY",
  "NFA", "DCA", "ROI", "DCF", "VWAP", "PCE", "YTD", "ITM", "OTM", "ATM",
  "SPX", "DJI", "VIX", "APY", "CFO", "CTO", "COO", "CMO",
  "CFD", "NAV", "AUM", "RFP", "EOD", "REIT", "SPAC",
  // ETFs — not candidates for breakout detection
  "SPY", "QQQ", "IWM", "DIA", "MDY", "IJR", "VTI", "VOO", "VEA", "VWO",
  "EEM", "EFA", "GLD", "SLV", "GDX", "GDXJ", "TLT", "IEF", "SHY", "LQD",
  "HYG", "JNK", "XLF", "XLE", "XLK", "XLV", "XLI", "XLY", "XLP", "XLU",
  "XLB", "XLRE", "XLC", "ARKK", "ARKG", "ARKW", "ARKF", "ARKQ", "ARKX",
  "SOXL", "SOXS", "TQQQ", "SQQQ", "SPXL", "SPXS", "UVXY", "SVXY",
  "IAU", "SLV", "USO", "UNG", "PDBC", "DBC", "FXI", "KWEB", "MCHI",
  "RSP", "QQQM", "SCHD", "VIG", "DGRO", "DVY", "SDY", "VYM", "HDV",
  "IEMG", "ACWI", "URTH", "VXUS", "BND", "AGG", "BNDX", "EMB", "MUB",
  // Reddit/internet slang
  "WSB", "HODL", "TLDR", "LMAO", "ROFL", "IMHO", "AFAIK", "NSFW", "TIL",
  "PSA", "IIRC", "FYI", "AMA",
  // Non-US markets/exchanges
  "TSX", "TSXV", "LSE", "ASX", "FTSE", "DAX", "NIKKEI",
  // Common 3-letter words
  "ALL", "ARE", "BUT", "CAN", "FOR", "GET", "HAS", "HAD", "HER", "HIM",
  "HIS", "HOW", "ITS", "LET", "MAY", "NEW", "NOT", "NOW", "OLD", "OUR",
  "OUT", "OWN", "SAY", "SHE", "THE", "TOO", "TWO", "WAY", "WHO", "BOY",
  "DID", "DON", "GOT", "HIT", "HOT", "LOT", "MAN", "PUT", "RAN", "RED",
  "RUN", "SET", "SIT", "TOP", "TRY", "USE", "WAS", "WIN", "WON", "YET",
  "YOU", "BIG", "ANY", "DAY", "END", "FAR", "FEW", "GAS",
  // Common 4-letter words (original)
  "HIGH", "LOW", "LONG", "JUST", "VERY", "MUCH", "THAT", "THIS", "WHAT",
  "WHEN", "WILL", "WITH", "HAVE", "FROM", "BEEN", "SOME", "THAN", "THEM",
  "THEN", "THEY", "CALL", "HOLD", "SELL", "PUMP", "DUMP", "MOON", "BEAR",
  "BULL", "GAIN", "LOSS", "EDIT", "HOPE", "BEST", "POST", "EVER", "STOP",
  "GOOD", "TAKE", "MAKE", "LIKE", "NEXT", "OVER", "BACK", "CASH", "RISK",
  "FREE", "HELP", "HERE", "LOOK", "ONLY", "REAL", "SURE", "WELL", "DOWN",
  "SAME", "OPEN", "TELL", "TRUE", "TURN", "KEEP", "EVEN", "LAST", "MOVE",
  "PAYS", "SAFE", "SAVE", "WORK",
  // Common 3-5 letter words (expanded)
  "TRIAL", "PHASE", "SHORT", "GAMMA", "DELTA", "THETA", "VEGA", "ENTRY", "EXIT",
  "WOW", "GOAT", "BEAT", "HYPE", "AUTO", "ALSO", "AWAY", "COME", "EACH",
  "ELSE", "FEEL", "FIND", "FIVE", "FOUR", "FULL", "GAVE", "GONE", "GROW",
  "HALF", "HAND", "HARD", "HEAD", "IDEA", "INTO", "KNEW", "KNOW", "LEFT",
  "LIFE", "LINE", "LIST", "LIVE", "MANY", "MOST", "MUST", "NAME", "NEED",
  "ONCE", "PART", "PAST", "PLAN", "PLAY", "PULL", "PURE", "PUSH", "READ",
  "REST", "RISE", "RULE", "SEEN", "SHOW", "SIDE", "SIGN", "SIZE", "TALK",
  "TEAM", "TECH", "TEND", "THUS", "TIME", "TONE", "TOLD", "TOOK", "TYPE",
  "UPON", "USED", "VAST", "VIEW", "VOTE", "WAIT", "WALK", "WANT", "WIDE",
  "WORD", "YEAR", "ZERO",
  // Crypto tickers (X/Twitter has heavy crypto discussion)
  "BTC", "ETH", "SOL", "DOGE", "XRP", "ADA", "AVAX", "DOT", "SHIB", "PEPE",
  // EDGAR RSS / XML structural tokens that regex-match as tickers
  "CIK", "UTC", "DIV", "RSS", "XML", "HTTP", "ATOM", "HREF", "HTML",
  // Common English words seen as false-positive tickers in production harvests
  "AFTER", "AGAIN", "AGENT", "ABOVE", "BELOW", "CALLS", "COOL", "DEAL",
  "DEBT", "MORE", "OUTTA", "PAID", "RIGHT", "SAFER", "SPLIT", "START",
  "STILL", "THANK", "THESE", "BEING", "COULD", "DOING", "EVERY", "GOING",
  "GREAT", "LEAST", "NEVER", "OTHER", "SHALL", "SINCE", "THEIR", "THERE",
  "THING", "THINK", "THOSE", "UNTIL", "WATCH", "WHERE", "WHICH", "WHILE",
  "WORLD", "WOULD", "ABOUT", "POINT", "MIGHT", "MONEY", "PRICE", "SHARE",
  "STOCK", "TODAY", "TRADE", "VALUE", "WORTH", "WHOLE", "FIRST", "GIVEN",
  // Financial/media acronyms that aren't tradeable tickers
  "CNBC", "FOMC", "OPEC", "OPEX", "MACD", "FINRA", "GAAP", "CAGR", "MOASS",
  "COMEX", "WSJ", "GOP", "NATO", "DOJ", "ECB", "DXY", "DARPA", "IEEPA",
  "HYSA", "IFRS",
  // Two-letter words missed in original list
  "DR", "ER", "IM", "IV", "OP", "PT", "SA", "SI", "TL", "DA", "FX",
  "HR", "PS", "WW",
  // More false-positive English/slang words from production harvests
  "SHIT", "POSTS", "HINT", "IRAN", "UAE", "BMW", "BASF",
  "LOTTO", "PIPE", "VLCC", "ISM", "GMT", "NPV", "FCF",
]);

export const MEGA_CAPS = new Set([
  "AAPL", "MSFT", "GOOG", "GOOGL", "AMZN", "META", "TSLA", "NVDA",
  "BRK", "JPM", "V", "MA", "UNH", "JNJ", "WMT", "PG",
]);

// S&P 100 and high-liquidity individual stocks for volume-spike scanning
// ETFs are excluded — volume spikes on ETFs don't indicate individual stock breakouts
export const SCAN_SYMBOLS = [
  // Mega-cap tech
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "ADBE",
  "CRM", "AMD", "INTC", "CSCO", "QCOM", "TXN", "IBM", "NOW", "INTU", "AMAT",
  // Financials
  "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP", "USB",
  // Healthcare
  "UNH", "JNJ", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT", "BMY", "AMGN",
  // Consumer
  "WMT", "HD", "MCD", "NKE", "SBUX", "TGT", "COST", "LOW", "DIS", "NFLX",
  // Energy
  "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "MPC", "PSX", "VLO", "HAL",
  // Industrials
  "CAT", "BA", "HON", "UPS", "GE", "RTX", "LMT", "DE", "MMM", "UNP",
  // Other large caps
  "V", "MA", "PYPL", "T", "VZ", "CMCSA", "PEP", "KO", "PM",
  // Meme / retail favorites
  "GME", "AMC", "PLTR", "SOFI", "RIVN", "LCID", "NIO", "SNAP", "COIN", "HOOD",
];

export function extractTickers(text: string): string[] {
  const matches = text.match(TICKER_REGEX) || [];
  return [...new Set(matches.filter((t) => !BLACKLIST.has(t) && !MEGA_CAPS.has(t) && t.length >= 2))];
}

/** Extract tickers from X/Twitter cashtag entities (e.g. $AAPL) */
export function extractCashtagTickers(cashtags: string[]): string[] {
  return [...new Set(
    cashtags
      .map((t) => t.toUpperCase())
      .filter((t) => !BLACKLIST.has(t) && !MEGA_CAPS.has(t) && t.length >= 2)
  )];
}
