import type { RawSignal } from "../types";
import { BLACKLIST } from "./ticker-utils";

const C_SUITE_TITLES = new Set([
  "CEO", "CFO", "COO", "CTO", "CMO", "CIO", "CISO", "CLO",
  "President", "Chairman", "Vice Chairman",
  "Dir", "Director",
  "Gen Counsel", "General Counsel",
  "EVP", "SVP", "VP",
  "Chief Executive Officer", "Chief Financial Officer",
  "Chief Operating Officer", "Chief Technology Officer",
]);

const MIN_PURCHASE_VALUE = 50_000;

interface InsiderRow {
  filingDate: string;
  tradeDate: string;
  ticker: string;
  companyName: string;
  insiderName: string;
  insiderTitle: string;
  tradeType: string;
  price: number;
  qty: number;
  value: number;
}

function isCsuiteOrDirector(title: string): boolean {
  const normalized = title.trim();
  for (const t of C_SUITE_TITLES) {
    if (normalized.includes(t)) return true;
  }
  return false;
}

function extractTicker(cellHtml: string): string {
  // Ticker cells contain JS tooltip junk like onmouseout="UnTip()" etc.
  // Try all anchors, pick the first that looks like a valid ticker (not blacklisted)
  const allMatches = [...cellHtml.matchAll(/>([A-Z]{1,5})<\/a>/g)];
  for (const m of allMatches) {
    const candidate = m[1];
    if (candidate.length >= 1 && !BLACKLIST.has(candidate)) return candidate;
  }
  // Fallback: strip tags, find uppercase word anchored to start
  const stripped = cellHtml.replace(/<[^>]*>/g, "").trim();
  const tickerMatch = stripped.match(/^([A-Z]{1,5})\b/);
  return tickerMatch ? tickerMatch[1] : stripped;
}

function parseOpenInsiderHtml(html: string): InsiderRow[] {
  const rows: InsiderRow[] = [];

  // Match table rows from the insider data table
  // OpenInsider uses class="tinytable" — match without strict tag-start anchor
  const tableMatch = html.match(/class="tinytable"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return rows;

  const tableHtml = tableMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;

  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = match[1];
    const cellsRaw: string[] = [];
    const cellsHtml: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cellsHtml.push(cellMatch[1]);
      // Strip HTML tags and trim
      cellsRaw.push(cellMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    // OpenInsider tinytable has 17 columns:
    // 0: X, 1: Filing Date, 2: Trade Date, 3: Ticker, 4: Company Name,
    // 5: Insider Name, 6: Title, 7: Trade Type, 8: Price, 9: Qty, 10: Owned,
    // 11: ΔOwn, 12: Value, 13: 1d, 14: 1w, 15: 1m, 16: 6m
    if (cellsRaw.length < 13) continue;

    const tradeType = cellsRaw[7].trim();
    // Only open market purchases ("P - Purchase")
    if (!tradeType.startsWith("P")) continue;

    const price = parseFloat(cellsRaw[8].replace(/[$,+]/g, ""));
    const qty = parseInt(cellsRaw[9].replace(/[,+]/g, ""), 10);
    const value = parseFloat(cellsRaw[12].replace(/[$,+]/g, ""));

    if (isNaN(price) || isNaN(value)) continue;

    // Extract ticker from raw HTML to handle JS tooltip junk
    const ticker = extractTicker(cellsHtml[3]);
    if (!ticker) continue;

    rows.push({
      filingDate: cellsRaw[1],
      tradeDate: cellsRaw[2],
      ticker,
      companyName: cellsRaw[4].trim(),
      insiderName: cellsRaw[5].trim(),
      insiderTitle: cellsRaw[6].trim(),
      tradeType,
      price,
      qty: isNaN(qty) ? 0 : qty,
      value,
    });
  }

  return rows;
}

async function fetchFromOpenInsider(): Promise<RawSignal[]> {
  try {
    // Fetch latest insider buying — open market purchases only, filed in last 7 days
    // OpenInsider does not support HTTPS (port 443 refused) — must use HTTP
    const url = "http://openinsider.com/screener?s=&o=&pl=50&ph=&ll=&lh=&fd=7&fdr=&td=0&tdr=&feession=0&cession=0&sid=1&iession=0&ession=0&otype=&othertype=&ression=0&sortcol=0&cnt=100&page=1";

    // OpenInsider's HTTP-only server is flaky — retry once on connect timeout / network errors.
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          signal: AbortSignal.timeout(15000),
        });
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`OpenInsider attempt ${attempt} failed (${msg}), retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (!res || !res.ok) {
      if (res) console.warn(`OpenInsider: ${res.status}`);
      return [];
    }

    const html = await res.text();
    const allRows = parseOpenInsiderHtml(html);

    // Filter: C-suite/directors only, $50K+ purchases
    const filtered = allRows.filter(
      (r) => r.value >= MIN_PURCHASE_VALUE && isCsuiteOrDirector(r.insiderTitle)
    );

    const signals: RawSignal[] = filtered.map((r) => ({
      symbol: r.ticker,
      source: "SEC_INSIDER" as const,
      title: `Insider purchase: ${r.insiderName} (${r.insiderTitle}) bought $${r.value.toLocaleString()} of ${r.ticker}`,
      body: `Trade date: ${r.tradeDate}. Filed: ${r.filingDate}. ${r.qty.toLocaleString()} shares at $${r.price}. Company: ${r.companyName}`,
      url: `http://openinsider.com/screener?s=${r.ticker}&o=&pl=&ph=&ll=&lh=&fd=0&fdr=&td=0&tdr=&feession=0&cession=0&sid=1&iession=0&ession=0&otype=&othertype=&ression=0&sortcol=0&cnt=100`,
      author: r.insiderName,
      insiderTitle: r.insiderTitle,
      purchaseValue: r.value,
    }));

    console.log(`OpenInsider: ${allRows.length} purchases found, ${signals.length} C-suite/director $50K+ signals`);
    return signals;
  } catch (err) {
    console.warn("OpenInsider error:", err);
    return [];
  }
}

export async function fetchSecInsiderSignals(): Promise<RawSignal[]> {
  const signals = await fetchFromOpenInsider();
  console.log(`SEC Insider: ${signals.length} signals`);
  return signals;
}
