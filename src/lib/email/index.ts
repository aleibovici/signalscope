import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface ConfirmedTicker {
  symbol: string;
  price?: number | null;
  aiScore: number;
  catalyst?: string | null;
  signalType?: string | null;
}

export function buildEmailHtml(tickers: ConfirmedTicker[]): string {
  const tickerRows = tickers
    .map(
      (t) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <a href="http://localhost:3000/ticker/${t.symbol}" style="color:#2563eb;font-weight:600;text-decoration:none;">${t.symbol}</a>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.aiScore}/100</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.catalyst || "—"}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">SignalScope Alert</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">${tickers.length} confirmed ticker${tickers.length !== 1 ? "s" : ""} detected</p>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:16px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;">
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Symbol</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Score</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Catalyst</th>
          </tr>
        </thead>
        <tbody>${tickerRows}</tbody>
      </table>
      <p style="margin:20px 0 8px;font-size:13px;color:#6b7280;">
        <a href="http://localhost:3000" style="color:#2563eb;text-decoration:none;">View full dashboard →</a>
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        You're receiving this because email alerts are enabled on your SignalScope profile.
        To unsubscribe, disable alerts in your <a href="http://localhost:3000/profile" style="color:#9ca3af;">profile settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

export async function sendConfirmedTickerAlerts(
  confirmedTickers: ConfirmedTicker[]
): Promise<void> {
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set — skipping email alerts");
    return;
  }

  if (confirmedTickers.length === 0) {
    console.log("[email] No confirmed tickers — skipping email alerts");
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

  const html = buildEmailHtml(confirmedTickers);
  const subject = `SignalScope: ${confirmedTickers.length} confirmed ticker${confirmedTickers.length !== 1 ? "s" : ""} — ${confirmedTickers.map((t) => t.symbol).join(", ")}`;

  console.log(`[email] Sending digest to ${users.length} user(s)...`);

  const batch = users.map((user) => ({
    from: "SignalScope Alerts <REDACTED>",
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
