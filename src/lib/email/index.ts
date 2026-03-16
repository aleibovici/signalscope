import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/stage-labels";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface AlertTicker {
  symbol: string;
  price?: number | null;
  aiScore: number;
  catalyst?: string | null;
  signalType?: string | null;
  stage: string;
}

export function buildEmailHtml(tickers: AlertTicker[], totalAvailable?: number): string {
  const confirmed = tickers.filter((t) => t.stage === "CONFIRMED");
  const forming = tickers.filter((t) => t.stage === "FORMING");
  const early = tickers.filter((t) => t.stage === "EARLY");

  function renderSection(label: string, items: AlertTicker[], color: string, maxItems?: number): string {
    if (items.length === 0) return "";
    const displayed = maxItems ? items.slice(0, maxItems) : items;
    const remaining = items.length - displayed.length;
    const rows = displayed
      .map(
        (t) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <a href="https://signalscopes.com/ticker/${t.symbol}" style="color:#2563eb;font-weight:600;text-decoration:none;">${t.symbol}</a>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.aiScore}/100</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.catalyst || "—"}</td>
      </tr>`
      )
      .join("");

    const moreLink = remaining > 0
      ? `<tr><td colspan="3" style="padding:8px 12px;border-bottom:1px solid #e5e7eb;"><a href="https://signalscopes.com/dashboard" style="color:#2563eb;font-size:13px;text-decoration:none;">+${remaining} more emerging signal${remaining !== 1 ? "s" : ""} — view on dashboard →</a></td></tr>`
      : "";

    return `
      <tr><td colspan="3" style="padding:12px 12px 4px;font-weight:700;font-size:13px;color:${color};text-transform:uppercase;letter-spacing:0.5px;">${label} (${items.length})</td></tr>
      ${rows}${moreLink}`;
  }

  const totalCount = tickers.length;
  const headline = early.length > 0
    ? `${early.length} emerging${forming.length > 0 ? ` + ${forming.length} building` : ""}${confirmed.length > 0 ? ` + ${confirmed.length} consensus` : ""}`
    : `${totalCount} signal${totalCount !== 1 ? "s" : ""} detected`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">SignalScope Alert</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">${headline} detected</p>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:16px 24px;">
      <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Emerging signals historically outperform — act on these early before broader consensus forms. Consensus-stage tickers may already be priced in.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;">
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Symbol</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Score</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Catalyst</th>
          </tr>
        </thead>
        <tbody>${renderSection(STAGE_LABELS.EARLY, early, "#16a34a", 3)}${renderSection(STAGE_LABELS.FORMING, forming, "#ca8a04")}${renderSection(STAGE_LABELS.CONFIRMED, confirmed, "#6b7280")}</tbody>
      </table>
      ${totalAvailable && totalAvailable > tickers.length ? `<p style="margin:16px 0 4px;font-size:13px;color:#6b7280;">Showing top ${tickers.length} of ${totalAvailable} signals.</p>` : ""}
      <p style="margin:8px 0;font-size:13px;color:#6b7280;">
        <a href="https://signalscopes.com" style="color:#2563eb;text-decoration:none;">View all on dashboard →</a>
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        You're receiving this because email alerts are enabled on your SignalScope profile.
        To unsubscribe, disable alerts in your <a href="https://signalscopes.com/profile" style="color:#9ca3af;">profile settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

export async function sendTickerAlerts(
  tickers: AlertTicker[],
  totalAvailable?: number
): Promise<void> {
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set — skipping email alerts");
    return;
  }

  if (tickers.length === 0) {
    console.log("[email] No tickers to alert — skipping email alerts");
    return;
  }

  const users = await prisma.user.findMany({
    where: { emailAlerts: true },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log("[email] No users with email alerts enabled");
    return;
  }

  const html = buildEmailHtml(tickers, totalAvailable);
  const early = tickers.filter((t) => t.stage === "EARLY");
  const topSymbols = tickers.slice(0, 5).map((t) => t.symbol).join(", ");
  const subject = early.length > 0
    ? `SignalScope: ${early.length} emerging signal${early.length !== 1 ? "s" : ""} — ${topSymbols}`
    : `SignalScope: ${tickers.length} signal${tickers.length !== 1 ? "s" : ""} detected — ${topSymbols}`;

  console.log(`[email] Sending digest to ${users.length} user(s)...`);

  const batch = users.map((user) => ({
    from: "SignalScope Alerts <alerts@signalscopes.com>",
    to: user.email,
    subject,
    html,
  }));

  const { data, error } = await resend.batch.send(batch);

  if (error) {
    console.warn("[email] Batch send failed:", error);
    console.log(`[email] Done: 0 sent, ${users.length} failed`);
    return;
  }

  const sent = data?.data?.length ?? 0;
  for (let i = 0; i < users.length; i++) {
    const id = data?.data?.[i]?.id ?? "unknown";
    console.log(`[email] Sent to ${users[i].email} (id: ${id})`);
  }

  console.log(`[email] Done: ${sent} sent, 0 failed`);
}

// ---------------------------------------------------------------------------
// Portfolio consensus alerts — personalized per user
// ---------------------------------------------------------------------------

interface PortfolioAlertTicker {
  symbol: string;
  price?: number | null;
  aiScore: number;
  opportunityScore?: number;
  catalyst?: string | null;
  stage: string;
  entryPrice: number;
}

export function buildPortfolioAlertHtml(tickers: PortfolioAlertTicker[]): string {
  const confirmed = tickers.filter((t) => t.stage === "CONFIRMED");
  const forming = tickers.filter((t) => t.stage === "FORMING");

  function renderSection(label: string, items: PortfolioAlertTicker[], color: string): string {
    if (items.length === 0) return "";
    const rows = items
      .map(
        (t) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <a href="https://signalscopes.com/ticker/${t.symbol}" style="color:#2563eb;font-weight:600;text-decoration:none;">${t.symbol}</a>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.aiScore}/100</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">$${t.entryPrice.toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.catalyst || "—"}</td>
      </tr>`
      )
      .join("");

    return `
      <tr><td colspan="4" style="padding:12px 12px 4px;font-weight:700;font-size:13px;color:${color};text-transform:uppercase;letter-spacing:0.5px;">${label} (${items.length})</td></tr>
      ${rows}`;
  }

  const symbols = tickers.map((t) => t.symbol).join(", ");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">Portfolio Alert</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">Your stocks are gaining momentum — ${symbols}</p>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:16px 24px;">
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">The following stocks in your portfolio have reached a new signal stage in today's scan.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;">
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Symbol</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Score</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Entry</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Catalyst</th>
          </tr>
        </thead>
        <tbody>${renderSection(STAGE_LABELS.CONFIRMED, confirmed, "#6b7280")}${renderSection(STAGE_LABELS.FORMING, forming, "#ca8a04")}</tbody>
      </table>
      <p style="margin:16px 0 8px;font-size:13px;color:#6b7280;">
        <a href="https://signalscopes.com/portfolio" style="color:#2563eb;text-decoration:none;">View your portfolio →</a>
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        You're receiving this because email alerts are enabled on your SignalScope profile.
        To unsubscribe, disable alerts in your <a href="https://signalscopes.com/profile" style="color:#9ca3af;">profile settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

export async function sendPortfolioAlerts(): Promise<{ usersNotified: number; tickersMatched: number }> {
  if (!resend) {
    console.log("[email/portfolio] RESEND_API_KEY not set — skipping portfolio alerts");
    return { usersNotified: 0, tickersMatched: 0 };
  }

  // 1. Get latest completed scan
  const scan = await prisma.scan.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });

  if (!scan) {
    console.log("[email/portfolio] No completed scan — skipping");
    return { usersNotified: 0, tickersMatched: 0 };
  }

  // 2. Get all CONFIRMED + FORMING tickers from that scan
  const scanTickers = await prisma.validatedTicker.findMany({
    where: {
      scanId: scan.id,
      stage: { in: ["CONFIRMED", "FORMING"] },
    },
    select: {
      symbol: true,
      price: true,
      aiScore: true,
      opportunityScore: true,
      catalyst: true,
      stage: true,
    },
  });

  if (scanTickers.length === 0) {
    console.log("[email/portfolio] No CONFIRMED/FORMING tickers in latest scan");
    return { usersNotified: 0, tickersMatched: 0 };
  }

  const tickersBySymbol = new Map(scanTickers.map((t) => [t.symbol, t]));

  // 3. Get users with emailAlerts=true who have OPEN positions
  const users = await prisma.user.findMany({
    where: {
      emailAlerts: true,
      positions: { some: { status: "OPEN" } },
    },
    select: {
      id: true,
      email: true,
      positions: {
        where: { status: "OPEN" },
        select: { symbol: true, entryPrice: true },
      },
    },
  });

  if (users.length === 0) {
    console.log("[email/portfolio] No users with alerts enabled and open positions");
    return { usersNotified: 0, tickersMatched: 0 };
  }

  // 4. For each user, intersect their positions with scan tickers
  let usersNotified = 0;
  let tickersMatched = 0;

  for (const user of users) {
    const matches: PortfolioAlertTicker[] = [];
    for (const pos of user.positions) {
      const ticker = tickersBySymbol.get(pos.symbol);
      if (ticker) {
        matches.push({
          symbol: ticker.symbol,
          price: ticker.price,
          aiScore: ticker.aiScore,
          opportunityScore: ticker.opportunityScore,
          catalyst: ticker.catalyst,
          stage: ticker.stage,
          entryPrice: pos.entryPrice,
        });
      }
    }

    if (matches.length === 0) continue;

    // Sort: CONFIRMED first, then by score desc
    matches.sort((a, b) => {
      if (a.stage === "CONFIRMED" && b.stage !== "CONFIRMED") return -1;
      if (b.stage === "CONFIRMED" && a.stage !== "CONFIRMED") return 1;
      return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
    });

    const html = buildPortfolioAlertHtml(matches);
    const symbols = matches.map((t) => t.symbol).join(", ");
    const subject = `SignalScope: ${matches.length} portfolio stock${matches.length !== 1 ? "s" : ""} gaining momentum — ${symbols}`;

    const { error } = await resend.emails.send({
      from: "SignalScope Alerts <alerts@signalscopes.com>",
      to: user.email,
      subject,
      html,
    });

    if (error) {
      console.warn(`[email/portfolio] Failed to send to ${user.email}:`, error);
    } else {
      console.log(`[email/portfolio] Sent to ${user.email} — ${symbols}`);
      usersNotified++;
      tickersMatched += matches.length;
    }
  }

  console.log(`[email/portfolio] Done: ${usersNotified} users notified, ${tickersMatched} tickers matched`);
  return { usersNotified, tickersMatched };
}
