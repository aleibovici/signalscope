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

  function renderSection(label: string, items: AlertTicker[], color: string): string {
    if (items.length === 0) return "";
    const rows = items
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

    return `
      <tr><td colspan="3" style="padding:12px 12px 4px;font-weight:700;font-size:13px;color:${color};text-transform:uppercase;letter-spacing:0.5px;">${label} (${items.length})</td></tr>
      ${rows}`;
  }

  const totalCount = tickers.length;
  const headline = confirmed.length > 0
    ? `${confirmed.length} consensus + ${forming.length + early.length} emerging`
    : `${totalCount} emerging signal${totalCount !== 1 ? "s" : ""}`;

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
      <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Early signals historically outperform — consider these as potential entry points before broader consensus forms.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;">
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Symbol</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Score</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Catalyst</th>
          </tr>
        </thead>
        <tbody>${renderSection(STAGE_LABELS.CONFIRMED, confirmed, "#16a34a")}${renderSection(STAGE_LABELS.FORMING, forming, "#2563eb")}${renderSection(STAGE_LABELS.EARLY, early, "#6b7280")}</tbody>
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
  const confirmed = tickers.filter((t) => t.stage === "CONFIRMED");
  const topSymbols = tickers.slice(0, 5).map((t) => t.symbol).join(", ");
  const subject = confirmed.length > 0
    ? `SignalScope: ${confirmed.length} consensus + ${tickers.length - confirmed.length} emerging — ${topSymbols}`
    : `SignalScope: ${tickers.length} emerging signal${tickers.length !== 1 ? "s" : ""} — ${topSymbols}`;

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

// Backwards-compatible alias
export const sendConfirmedTickerAlerts = sendTickerAlerts;
