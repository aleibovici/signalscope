import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/stage-labels";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/* ------------------------------------------------------------------ */
/*  Free weekly digest — sent to ALL users, not just subscribers       */
/*  Shows top 3 tickers (symbol, score, catalyst) — no trade setups.   */
/*  Goal: convert free users → subscribers, twitter followers → users.  */
/* ------------------------------------------------------------------ */

interface DigestTicker {
  symbol: string;
  aiScore: number;
  opportunityScore: number;
  catalyst: string | null;
  stage: string;
  returnPct: number | null;
  returnPeriod: string | null;
}

interface DigestPerformer {
  symbol: string;
  returnPct: number;
  period: string;
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
  performers: DigestPerformer[],
  totalAvailable: number,
  isSubscriber: boolean,
): string {
  function renderTicker(t: DigestTicker): string {
    const stageLabel = STAGE_LABELS[t.stage] ?? t.stage;
    const stageColor = t.stage === "EARLY" ? "#16a34a" : t.stage === "FORMING" ? "#ca8a04" : "#6b7280";
    const catalystRow = t.catalyst
      ? `<tr><td colspan="3" style="padding:2px 12px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${truncateSummary(t.catalyst)}</td></tr>`
      : "";

    return `
      <tr>
        <td style="padding:8px 12px;${t.catalyst ? "" : "border-bottom:1px solid #e5e7eb;"}">
          <a href="http://localhost:3000/ticker/${t.symbol}" style="color:#2563eb;font-weight:600;text-decoration:none;">$${t.symbol}</a>
          <span style="font-size:11px;color:${stageColor};margin-left:6px;">${stageLabel}</span>
        </td>
        <td style="padding:8px 12px;${t.catalyst ? "" : "border-bottom:1px solid #e5e7eb;"}">${t.aiScore}/100</td>
        <td style="padding:8px 12px;${t.catalyst ? "" : "border-bottom:1px solid #e5e7eb;"}">${t.opportunityScore}/100</td>
      </tr>${catalystRow}`;
  }

  function renderPerformer(p: DigestPerformer): string {
    const color = p.returnPct >= 0 ? "#16a34a" : "#dc2626";
    return `<span style="display:inline-block;margin-right:16px;"><a href="http://localhost:3000/ticker/${p.symbol}" style="color:#2563eb;font-weight:600;text-decoration:none;">$${p.symbol}</a> <span style="color:${color};font-weight:600;">${formatPct(p.returnPct)}</span> <span style="color:#6b7280;font-size:12px;">(${p.period})</span></span>`;
  }

  const performerSection = performers.length > 0
    ? `
      <div style="margin:16px 0;padding:12px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;">
        <p style="margin:0 0 8px;font-weight:700;font-size:13px;color:#15803d;">📈 Recent Winners — Flagged by SignalScope</p>
        <p style="margin:0;font-size:14px;line-height:1.8;">${performers.map(renderPerformer).join("")}</p>
      </div>`
    : "";

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
      <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">Top emerging signals this week</p>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:16px 24px;">
      ${performerSection}
      <p style="margin:${performers.length > 0 ? "8" : "0"}px 0 12px;font-size:13px;color:#6b7280;">The highest-conviction signals detected across Reddit, X/Twitter, SEC filings, congressional trades, options flow, and volume spikes.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;">
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Ticker</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Signal</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;">Opportunity</th>
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
  performerCount: number;
}> {
  if (!resend) {
    console.log("[email/weekly] RESEND_API_KEY not set — skipping weekly digest");
    return { sent: 0, skipped: 0, tickerCount: 0, performerCount: 0 };
  }

  // 1. Get latest completed scan
  const scan = await prisma.scan.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });

  if (!scan) {
    console.log("[email/weekly] No completed scan — skipping");
    return { sent: 0, skipped: 0, tickerCount: 0, performerCount: 0 };
  }

  // 2. Top 3 tickers by opportunity score (EARLY/FORMING preferred)
  // NOTE: orderBy stage alphabetically gives CONFIRMED < EARLY < FORMING (wrong order).
  // Sort in JS with explicit priority: EARLY=0, FORMING=1, CONFIRMED=2.
  const STAGE_PRIORITY: Record<string, number> = { EARLY: 0, FORMING: 1, CONFIRMED: 2 };
  const topTickersRaw = await prisma.validatedTicker.findMany({
    where: {
      scanId: scan.id,
      stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
      pndFlagged: false,
      aiScore: { gte: 50 },
      recommendation: { in: ["Strong Buy", "Buy", "Watch"] },
    },
    orderBy: [{ opportunityScore: "desc" }],
    take: 20,
    select: {
      symbol: true,
      aiScore: true,
      opportunityScore: true,
      catalyst: true,
      stage: true,
    },
  });
  const topTickers = topTickersRaw
    .sort((a, b) => {
      const stageDiff = (STAGE_PRIORITY[a.stage] ?? 9) - (STAGE_PRIORITY[b.stage] ?? 9);
      if (stageDiff !== 0) return stageDiff;
      return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
    })
    .slice(0, 3);

  if (topTickers.length === 0) {
    console.log("[email/weekly] No qualifying tickers — skipping");
    return { sent: 0, skipped: 0, tickerCount: 0, performerCount: 0 };
  }

  // 3. Top performers from TickerPerformance (proof section)
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const perfRows = await prisma.tickerPerformance.findMany({
    where: {
      createdAt: { gte: cutoff },
      corporateActionDetected: false,
      validatedTicker: {
        pndFlagged: false,
        recommendation: { in: ["Strong Buy", "Buy"] },
      },
    },
    include: {
      validatedTicker: { select: { symbol: true } },
    },
    take: 100,
  });

  // Pick best return per symbol
  const performers: DigestPerformer[] = [];
  const seenSymbols = new Set<string>();

  const perfCandidates: { symbol: string; returnPct: number; period: string }[] = [];
  for (const row of perfRows) {
    const sym = row.validatedTicker.symbol;
    if (row.return7d !== null && row.return7d >= 0.08) {
      perfCandidates.push({ symbol: sym, returnPct: row.return7d, period: "7d" });
    } else if (row.return3d !== null && row.return3d >= 0.05) {
      perfCandidates.push({ symbol: sym, returnPct: row.return3d, period: "3d" });
    } else if (row.return30d !== null && row.return30d >= 0.12) {
      perfCandidates.push({ symbol: sym, returnPct: row.return30d, period: "30d" });
    }
  }

  perfCandidates.sort((a, b) => b.returnPct - a.returnPct);
  for (const c of perfCandidates) {
    if (seenSymbols.has(c.symbol)) continue;
    seenSymbols.add(c.symbol);
    performers.push(c);
    if (performers.length >= 3) break;
  }

  // 4. Total available for context
  const totalAvailable = await prisma.validatedTicker.count({
    where: {
      scanId: scan.id,
      stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
    },
  });

  // 5. Get ALL users with emailAlerts enabled (not just subscribers)
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
    return { sent: 0, skipped: 0, tickerCount: topTickers.length, performerCount: performers.length };
  }

  const digestTickers: DigestTicker[] = topTickers.map((t) => ({
    symbol: t.symbol,
    aiScore: t.aiScore,
    opportunityScore: t.opportunityScore,
    catalyst: t.catalyst,
    stage: t.stage,
    returnPct: null,
    returnPeriod: null,
  }));

  // 6. Send — subscribers get one CTA, free users get an upgrade CTA
  const ACTIVE_STATUSES = ["ACTIVE", "PAST_DUE"];

  const subscriberEmails: { from: string; to: string; subject: string; html: string }[] = [];
  const freeEmails: { from: string; to: string; subject: string; html: string }[] = [];

  const topSymbols = digestTickers.map((t) => `$${t.symbol}`).join(", ");
  const subject = `SignalScope Weekly: ${topSymbols}${performers.length > 0 ? ` + ${performers.length} recent winners` : ""}`;

  const subscriberHtml = buildWeeklyDigestHtml(digestTickers, performers, totalAvailable, true);
  const freeHtml = buildWeeklyDigestHtml(digestTickers, performers, totalAvailable, false);

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
    `[email/weekly] Done: ${sent} sent (${subscriberEmails.length} subscribers, ${freeEmails.length} free), ${skipped} failed, ${topTickers.length} tickers, ${performers.length} performers`
  );

  return { sent, skipped, tickerCount: topTickers.length, performerCount: performers.length };
}
