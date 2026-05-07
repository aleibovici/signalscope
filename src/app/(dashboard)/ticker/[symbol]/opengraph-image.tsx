import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { stageLabel } from "@/lib/stage-labels";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same bordered badge style as signal-card.tsx (light mode values)
const recStyles: Record<string, { border: string; color: string }> = {
  "Strong Buy": { border: "rgba(16,185,129,0.7)", color: "#059669" },
  Buy:          { border: "rgba(34,197,94,0.7)",  color: "#16a34a" },
  Watch:        { border: "rgba(245,158,11,0.7)", color: "#d97706" },
  Avoid:        { border: "rgba(239,68,68,0.6)",  color: "#dc2626" },
};

// Arc gauge — exactly the same path as signal-card.tsx
const ARC_D = "M 8 36 A 32 32 0 0 1 72 36";
const ARC_LEN = Math.PI * 32; // ≈ 100.53

function arcFill(score: number): number {
  return (Math.min(Math.max(score, 0), 100) / 100) * ARC_LEN;
}

function formatPrice(p: number): string {
  return p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(4)}`;
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "\u2026";
}

type TickerRow = {
  symbol: string;
  name: string | null;
  price: number | null;
  marketCap: number | null;
  recommendation: string | null;
  opportunityScore: number;
  aiScore: number;
  catalyst: string | null;
  risks: string | null;
  signalCount: number;
  stage: string;
  priorAppearances: number;
  firstSeenDaysAgo: number | null;
  wk52Lo: number | null;
  wk52Hi: number | null;
  shortFloat: number | null;
  exchange: string | null;
  avgVelocity: number | null;
  subredditCount: number | null;
  pndFlagged: boolean;
};

// Same logic as collectTags() in signal-card.tsx
function collectTags(t: TickerRow): string[] {
  const tags: string[] = [];
  if (t.priorAppearances >= 3) tags.push(`Seen ${t.priorAppearances}x`);
  if (t.firstSeenDaysAgo === null) tags.push("New");
  if (
    t.price != null && t.wk52Lo != null && t.wk52Lo > 0 &&
    (t.price - t.wk52Lo) / t.wk52Lo >= 0.007 &&
    (t.price - t.wk52Lo) / t.wk52Lo < 0.5
  ) tags.push("Near 52W Low");
  if (t.price != null && t.wk52Hi != null && t.wk52Hi > 0 && t.price / t.wk52Hi >= 0.95)
    tags.push("Momentum");
  if (
    t.shortFloat != null && t.shortFloat >= 0.15 &&
    t.price != null && t.price < 5 && t.exchange != null &&
    (t.exchange.toLowerCase().includes("american") ||
      t.exchange.toLowerCase().includes("nasdaqcm") ||
      t.exchange.toLowerCase().includes("nasdaq capital"))
  ) tags.push("Short Squeeze");
  if (t.shortFloat != null && t.shortFloat >= 0.075 && t.shortFloat < 0.15)
    tags.push("High SI");
  if (t.avgVelocity != null && t.avgVelocity >= 2.5) tags.push("High Velocity");
  if (
    t.price != null && t.wk52Hi != null && t.wk52Lo != null && t.wk52Lo > 0 &&
    (t.price - t.wk52Lo) / t.wk52Lo < 0.3 && t.wk52Hi / t.price > 3.0
  ) tags.push("Recovery");
  if (t.subredditCount != null && t.subredditCount >= 3) tags.push("Multi-Reddit");
  if (t.pndFlagged) tags.push("P&D Risk");
  const stage = stageLabel(t.stage);
  if (stage && !tags.some((x) => x.toLowerCase() === stage.toLowerCase())) tags.push(stage);
  return tags;
}

function fallbackImage(upper: string): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 16 }}>
          <span style={{ fontSize: 100, fontWeight: 800, color: "white", letterSpacing: "-2px", lineHeight: 1 }}>
            ${upper}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: "white" }}>Signal</span>
          <span style={{ fontSize: 40, fontWeight: 800, color: "#93c5fd" }}>Scope</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

export default async function OgImage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  let ticker: TickerRow | null = null;
  let sources: string[] = [];

  try {
    const row = await prisma.validatedTicker.findFirst({
      where: { symbol: upper },
      orderBy: { createdAt: "desc" },
      select: {
        symbol: true, name: true, price: true, marketCap: true,
        recommendation: true, opportunityScore: true, aiScore: true,
        catalyst: true, risks: true, signalCount: true, stage: true,
        priorAppearances: true, firstSeenDaysAgo: true,
        wk52Lo: true, wk52Hi: true, shortFloat: true, exchange: true,
        avgVelocity: true, subredditCount: true, pndFlagged: true,
        scanId: true,
      },
    });

    if (!row) return fallbackImage(upper);
    ticker = row as TickerRow;

    const signals = await prisma.signal.findMany({
      where: { scanId: row.scanId, symbol: upper },
      select: { source: true },
    });
    sources = [...new Set(signals.map((s) => s.source))];
  } catch {
    return fallbackImage(upper);
  }

  if (!ticker) return fallbackImage(upper);

  const rec = ticker.recommendation ?? "Watch";
  const recStyle = recStyles[rec] ?? { border: "#9ca3af", color: "#6b7280" };
  const oppFill = arcFill(ticker.opportunityScore);
  const aiFill  = arcFill(ticker.aiScore);
  const tags = collectTags(ticker).slice(0, 5);
  const hasCatalyst = Boolean(ticker.catalyst);
  const hasRisks = Boolean(ticker.risks);

  return new ImageResponse(
    (
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "44px 52px 36px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Row 1: symbol + badge | price + market cap */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 76, fontWeight: 800, color: "#111827", letterSpacing: "-1px", lineHeight: 1 }}>
              {ticker.symbol}
            </span>
            <div
              style={{
                border: `2px solid ${recStyle.border}`,
                color: recStyle.color,
                fontSize: 20,
                fontWeight: 700,
                padding: "5px 14px",
                borderRadius: 6,
                textTransform: "uppercase",
                letterSpacing: "1px",
                lineHeight: 1,
                marginTop: 10,
              }}
            >
              {rec}
            </div>
          </div>
          {ticker.price != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 48, fontWeight: 700, color: "#111827", lineHeight: 1 }}>
                {formatPrice(ticker.price)}
              </span>
              {ticker.marketCap != null && (
                <span style={{ fontSize: 20, color: "#6b7280", marginTop: 6 }}>
                  {formatMarketCap(ticker.marketCap)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Row 2: company name */}
        {ticker.name && (
          <div style={{ fontSize: 22, color: "#6b7280", marginTop: 6, display: "flex" }}>
            {truncate(ticker.name, 55)}
          </div>
        )}

        {/* Row 3: arc gauges — same SVG path as signal-card, scaled 2× via width/height */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 80, marginTop: 22 }}>
          {/* Opportunity */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "2px" }}>
              Opportunity
            </span>
            <svg width="160" height="76" viewBox="0 1 80 38">
              <path d={ARC_D} fill="none" stroke="#e5e7eb" strokeWidth={5} strokeLinecap="round" />
              <path d={ARC_D} fill="none" stroke="#f59e0b" strokeWidth={5} strokeLinecap="round"
                strokeDasharray={`${oppFill} ${ARC_LEN}`} />
            </svg>
            <span style={{ fontSize: 36, fontWeight: 800, color: "#111827", lineHeight: 1, marginTop: -4 }}>
              {ticker.opportunityScore}
            </span>
          </div>

          {/* AI Confidence */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "2px" }}>
              AI Confidence
            </span>
            <svg width="160" height="76" viewBox="0 1 80 38">
              <path d={ARC_D} fill="none" stroke="#e5e7eb" strokeWidth={5} strokeLinecap="round" />
              <path d={ARC_D} fill="none" stroke="#3b82f6" strokeWidth={5} strokeLinecap="round"
                strokeDasharray={`${aiFill} ${ARC_LEN}`} />
            </svg>
            <span style={{ fontSize: 36, fontWeight: 800, color: "#111827", lineHeight: 1, marginTop: -4 }}>
              {ticker.aiScore}
            </span>
          </div>
        </div>

        {/* Row 4: tags */}
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            {tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  border: "1px solid rgba(209,213,219,0.7)",
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontSize: 14,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#6b7280",
                  display: "flex",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Row 5: thesis + risks (two columns, border-t) */}
        {(hasCatalyst || hasRisks) && (
          <div
            style={{
              display: "flex",
              gap: 40,
              marginTop: 18,
              paddingTop: 18,
              borderTop: "1px solid #f3f4f6",
              flexGrow: 1,
            }}
          >
            {hasCatalyst && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#14b8a6", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6 }}>
                  Thesis
                </span>
                <span style={{ fontSize: 18, color: "#374151", lineHeight: 1.5 }}>
                  {truncate(ticker.catalyst!, 130)}
                </span>
              </div>
            )}
            {hasRisks && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6 }}>
                  Risks
                </span>
                <span style={{ fontSize: 18, color: "#374151", lineHeight: 1.5 }}>
                  {truncate(ticker.risks!, 130)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer: sources + signal count + SignalScope branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid #f3f4f6",
          }}
        >
          {/* Left: source chips + signal count */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sources.slice(0, 3).map((src) => (
              <div
                key={src}
                style={{
                  border: "1px solid rgba(229,231,235,0.9)",
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#9ca3af",
                  display: "flex",
                }}
              >
                {src.replace(/_/g, " ")}
              </div>
            ))}
            {sources.length > 3 && (
              <span style={{ fontSize: 12, color: "#9ca3af" }}>+{sources.length - 3}</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: "#60a5fa" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}>{ticker.signalCount}</span>
              <span style={{ fontSize: 14, color: "#6b7280" }}>signals</span>
            </div>
          </div>

          {/* Right: branding */}
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#1e3a5f" }}>Signal</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#3b82f6" }}>Scope</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
