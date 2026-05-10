import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/stage-labels";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/* ------------------------------------------------------------------ */
/*  Free weekly digest — sent to ALL users, not just subscribers       */
/*  Shows the top 5 picks from the past 7 days ranked by best return.  */
/*  Goal: prove the system works, convert free users → subscribers.    */
/* ------------------------------------------------------------------ */

interface DigestTicker {
  symbol: string;
  aiScore: number;
  opportunityScore: number;
  catalyst: string | null;
  stage: string;
  returnPct: number;
  returnPeriod: string;
}

function formatPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;
}

function truncateSummary(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

export function buildWeeklyDigestHtml(
  tickers: DigestTicker[],
  totalAvailable: number,
  isSubscriber: boolean,
): string {
  function renderTicker(t: DigestTicker): string {
    const stageLabel = STAGE_LABELS[t.stage] ?? t.stage;
    const stageColor = t.stage === "EARLY" ? "#16a34a" : t.stage === "FORMING" ? "#ca8a04" : "#6b7280";
    const returnColor = t.returnPct >= 0 ? "#16a34a" : "#dc2626";
    const catalystRow = t.catalyst
      ? `<tr><td colspan="3" style="padding:2px 12px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${truncateSummary(t.catalyst)}</td></tr>`
      : "";

    return `
      <tr>
        <td style="padding:8px 12px;${t.catalyst ? "" : "border-bottom:1px solid #e5e7eb;"}">
          <a href="http://localhost:3000/ticker/${t.symbol}" style="color:#2563eb;font-weight:600;text-decoration:none;">$${t.symbol}</a>
          <span style="font-size:11px;color:${stageColor};margin-left:6px;">${stageLabel}</span>
        </td>
        <td style="padding:8px 12px;${t.catalyst ? "" : "border-bottom:1px solid #e5e7eb;"}">
          <span style="color:${returnColor};font-weight:700;">${formatPct(t.returnPct)}</span>
          <span style="color:#6b7280;font-size:11px;margin-left:4px;">(${t.returnPeriod})</span>
        </td>
        <td style="padding:8px 12px;${t.catalyst ? "" : "border-bottom:1px solid #e5e7eb;"}">${t.aiScore}/100</td>
      </tr>${catalystRow}`;
  }

  const ctaSection = isSubscriber
    ? `<p style="margin:16px 0 8px;font-size:13px;color:#6b7280;">
        <a href="http://localhost:3000/dashboard" style="color:#2563eb;text-decoration:none;">View all ${totalAvailable} signals on your dashboard →</a>
      </p>`
    : `<div style="margin:16px 0;padding:12px;background:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;">
        <p style="margin:0 0 4px;font-weight:600;font-size:14px;color:#1d4ed8;">Want the full picture?</p>
        <p style="margin:0;font-size:13px;color:#1e40af;">Pro subscribers get daily alerts, AI trade setups with entry/exit levels, and API access. ${totalAvailable} signals were detected this week.</p>
        <p style="margin:8px 0 0;"><a href="http://localhost:3000/subscription" style="display:inline-block;padding:6px 16px;background:#2563eb;color:#fff;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600;">Upgrade to Pro →</a></p>
      </div>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">SignalScope Weekly Digest</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">This week's top performers</p>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:16px 24px;">
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Picks from the past 7 days — ranked by best return — across Reddit, X/Twitter, SEC filings, congressional trades, options flow, and volume spikes.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;">
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Ticker</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Return</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Signal</th>
          </tr>
        </thead>
        <tbody>${tickers.map(renderTicker).join("")}</tbody>
      </table>
      ${ctaSection}
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
        You're receiving this free weekly digest because you have a SignalScope account.
        To unsubscribe, disable email alerts in your <a href="http://localhost:3000/profile" style="color:#9ca3af;">profile settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

/* ------------------------------------------------------------------ */
/*  Send weekly digest to all users                                    */
/* ------------------------------------------------------------------ */

export async function sendWeeklyDigest(): Promise<{
  sent: number;
  skipped: number;
  tickerCount: number;
}> {
  if (!resend) {
    console.log("[email/weekly] RESEND_API_KEY not set — skipping weekly digest");
    return { sent: 0, skipped: 0, tickerCount: 0 };
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Pull every performance row for picks made in the last 7 days
  const perfRows = await prisma.tickerPerformance.findMany({
    where: {
      createdAt: { gte: cutoff },
      corporateActionDetected: false,
      validatedTicker: {
        pndFlagged: false,
        recommendation: { in: ["Strong Buy", "Buy", "Watch"] },
      },
    },
    include: {
      validatedTicker: {
        select: {
          symbol: true,
          aiScore: true,
          opportunityScore: true,
          catalyst: true,
          stage: true,
        },
      },
    },
  });

  // 2. For each row pick the best of return1d/3d/7d. Dedupe by symbol.
  //    Drop anything that isn't positive — "top performers" must have run up.
  const bestPerSymbol = new Map<string, DigestTicker>();
  for (const row of perfRows) {
    const periods: Array<{ pct: number | null; label: string }> = [
      { pct: row.return1d, label: "1d" },
      { pct: row.return3d, label: "3d" },
      { pct: row.return7d, label: "7d" },
    ];
    let bestPct: number | null = null;
    let bestLabel = "";
    for (const p of periods) {
      if (p.pct !== null && (bestPct === null || p.pct > bestPct)) {
        bestPct = p.pct;
        bestLabel = p.label;
      }
    }
    if (bestPct === null || bestPct <= 0) continue;

    const v = row.validatedTicker;
    const existing = bestPerSymbol.get(v.symbol);
    if (!existing || bestPct > existing.returnPct) {
      bestPerSymbol.set(v.symbol, {
        symbol: v.symbol,
        aiScore: v.aiScore,
        opportunityScore: v.opportunityScore,
        catalyst: v.catalyst,
        stage: v.stage,
        returnPct: bestPct,
        returnPeriod: bestLabel,
      });
    }
  }

  const topTickers = Array.from(bestPerSymbol.values())
    .sort((a, b) => b.returnPct - a.returnPct)
    .slice(0, 5);

  if (topTickers.length === 0) {
    console.log("[email/weekly] No qualifying performers in the last 7 days — skipping");
    return { sent: 0, skipped: 0, tickerCount: 0 };
  }

  // 3. Total picks made this week (used in the upgrade/dashboard CTA)
  const totalAvailable = await prisma.tickerPerformance.count({
    where: {
      createdAt: { gte: cutoff },
      validatedTicker: {
        pndFlagged: false,
        recommendation: { in: ["Strong Buy", "Buy", "Watch"] },
      },
    },
  });

  // 4. Get ALL users with emailAlerts enabled (not just subscribers)
  const users = await prisma.user.findMany({
    where: { emailAlerts: true },
    select: {
      id: true,
      email: true,
      subscription: { select: { status: true } },
    },
  });

  if (users.length === 0) {
    console.log("[email/weekly] No users with email alerts enabled");
    return { sent: 0, skipped: 0, tickerCount: topTickers.length };
  }

  // 5. Send — subscribers get one CTA, free users get an upgrade CTA
  const ACTIVE_STATUSES = ["ACTIVE", "PAST_DUE"];

  const subscriberEmails: { from: string; to: string; subject: string; html: string }[] = [];
  const freeEmails: { from: string; to: string; subject: string; html: string }[] = [];

  const headlineSymbols = topTickers
    .slice(0, 3)
    .map((t) => `$${t.symbol} ${formatPct(t.returnPct)}`)
    .join(", ");
  const subject = `SignalScope Weekly: ${headlineSymbols}`;

  const subscriberHtml = buildWeeklyDigestHtml(topTickers, totalAvailable, true);
  const freeHtml = buildWeeklyDigestHtml(topTickers, totalAvailable, false);

  for (const user of users) {
    const isSub = user.subscription && ACTIVE_STATUSES.includes(user.subscription.status);
    const email = {
      from: "SignalScope <REDACTED>",
      to: user.email,
      subject,
      html: isSub ? subscriberHtml : freeHtml,
    };
    if (isSub) {
      subscriberEmails.push(email);
    } else {
      freeEmails.push(email);
    }
  }

  let sent = 0;
  let skipped = 0;

  // Send in batches (Resend batch limit is 100)
  const allEmails = [...subscriberEmails, ...freeEmails];
  const BATCH_SIZE = 100;

  for (let i = 0; i < allEmails.length; i += BATCH_SIZE) {
    const batch = allEmails.slice(i, i + BATCH_SIZE);
    const { data, error } = await resend.batch.send(batch);

    if (error) {
      console.warn(`[email/weekly] Batch ${i / BATCH_SIZE + 1} failed:`, error);
      skipped += batch.length;
    } else {
      const batchSent = data?.data?.length ?? 0;
      sent += batchSent;
      skipped += batch.length - batchSent;
    }
  }

  console.log(
    `[email/weekly] Done: ${sent} sent (${subscriberEmails.length} subscribers, ${freeEmails.length} free), ${skipped} failed, ${topTickers.length} top performers`
  );

  return { sent, skipped, tickerCount: topTickers.length };
}
