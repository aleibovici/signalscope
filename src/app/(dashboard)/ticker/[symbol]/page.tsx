"use client";

import { Fragment, use, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTickerDetail, useTickerHistory, useGenerateReport } from "@/hooks/use-scans";
import { useTickerPerformance } from "@/hooks/use-performance";
import { useWatchlist, useToggleWatchlist } from "@/hooks/use-watchlist";
import { AddPositionModal } from "@/components/dashboard/add-position-modal";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Sparkline } from "@/components/ui/sparkline";
import { TradeSetupCard } from "@/components/ticker/trade-setup-card";

function formatTimeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const SOURCE_LABELS: Record<string, string> = {
  SEC_INSIDER: "SEC Insider Filing",
  SEC_FILING: "SEC Filing",
  CONGRESS: "Congressional Trade",
  OPTIONS_FLOW: "Options Flow",
  VOLUME_SPIKE: "Volume Spike",
  REDDIT: "Reddit",
  TWITTER: "Twitter / X",
  STOCKTWITS: "StockTwits",
  POLYMARKET: "Polymarket",
};

function formatSource(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function formatExchangeLabel(ex: string | null): string | null {
  if (!ex?.trim()) return null;
  const t = ex.trim();
  if (/^NMS$/i.test(t) || /^NasdaqGS$/i.test(t)) return "NASDAQ";
  return t;
}

function marketCapTierLabel(mc: number | null): string | null {
  if (mc == null || mc <= 0) return null;
  const b = mc / 1e9;
  if (b < 0.3) return "Micro / nano cap";
  if (b < 2) return "Small cap";
  if (b < 10) return "Mid cap";
  if (b < 200) return "Large cap";
  return "Mega cap";
}

function relativeStrengthFrom52w(price: number | null, lo: number | null, hi: number | null): number | null {
  if (price == null || lo == null || hi == null || hi <= lo) return null;
  const t = (price - lo) / (hi - lo);
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
}

/** 0–100 for CSS positioning; clamps price outside [lo, hi] to the bar ends. */
function pctAlong52wRange(price: number, lo: number, hi: number): number {
  if (hi <= lo) return 50;
  const t = (price - lo) / (hi - lo);
  return Math.min(100, Math.max(0, t * 100));
}

function formatPriceForRange(p: number): string {
  return p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(4)}`;
}

function week52BarInputs(
  lo: number | null,
  hi: number | null,
  price: number | null,
): { lo: number; hi: number; price: number } | null {
  if (lo == null || hi == null || hi <= lo || price == null || price <= 0) return null;
  return { lo, hi, price };
}

function Week52PositionRow({
  lo,
  hi,
  price,
  hint,
}: {
  lo: number;
  hi: number;
  price: number;
  hint: string;
}) {
  const pct = pctAlong52wRange(price, lo, hi);
  const rs = relativeStrengthFrom52w(price, lo, hi);
  const dotTint =
    rs != null && rs >= 70 ? "bg-emerald-500 dark:bg-emerald-400" : "bg-blue-600 dark:bg-blue-400";
  return (
    <div
      className="min-w-0 py-2"
      role="img"
      aria-label={`52-week range from ${formatPriceForRange(lo)} to ${formatPriceForRange(hi)}, price near ${formatPriceForRange(price)}`}
    >
      <span className="mb-1.5 flex items-center gap-1 text-sm text-slate-500 dark:text-zinc-500">
        52-week range
        <InfoHint text={hint} />
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900 dark:text-white">
          {formatPriceForRange(lo)}
        </span>
        <div className="relative min-h-4 min-w-0 flex-1">
          <div
            className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-slate-300 dark:bg-zinc-600"
            aria-hidden
          />
          <div
            className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm dark:border-[#12181f] ${dotTint}`}
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900 dark:text-white">
          {formatPriceForRange(hi)}
        </span>
      </div>
    </div>
  );
}

function sentimentDescriptor(avg: number | null): string {
  if (avg == null) return "—";
  if (avg > 0.15) return "Bullish";
  if (avg < -0.15) return "Bearish";
  return "Neutral";
}

function institutionalFlowLabel(sources: string[]): string {
  const inst = new Set(["SEC_INSIDER", "CONGRESS", "OPTIONS_FLOW", "SEC_FILING"]);
  const hit = sources.filter((s) => inst.has(s)).length;
  if (hit >= 2) return "Heavy inflow";
  if (hit === 1) return "Moderate";
  return "Retail-led";
}

function flowValueClass(label: string): string {
  if (label === "Heavy inflow") return "text-emerald-600 dark:text-emerald-400";
  if (label === "Moderate") return "text-amber-600 dark:text-amber-400";
  return "text-slate-600 dark:text-zinc-400";
}

function formatMarketCapCompact(mc: number | null): string {
  if (mc == null || mc <= 0) return "N/A";
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(2)}B`;
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(2)}M`;
  return `${Math.round(mc / 1e3)}K`;
}

function formatNetPremiumCompact(np: number): string {
  const abs = Math.abs(np);
  const sign = np >= 0 ? "+" : "-";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs}`;
}

function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback((delay = 120) => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setPos(null);
    }, delay);
  }, [clearCloseTimer]);

  const show = useCallback(() => {
    clearCloseTimer();
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top, left: r.left + r.width / 2 });
    setOpen(true);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      setOpen(false);
      setPos(null);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  const tooltip =
    mounted &&
    open &&
    pos &&
    createPortal(
      <span
        role="tooltip"
        className="fixed z-400 max-w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-snug text-slate-700 shadow-lg dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
        style={{ top: pos.top - 8, left: pos.left }}
        onPointerEnter={clearCloseTimer}
        onPointerLeave={(e) => scheduleClose(e.pointerType === "touch" ? 3000 : 120)}
      >
        {text}
      </span>,
      document.body,
    );

  return (
    <>
      <span
        ref={anchorRef}
        role="button"
        tabIndex={0}
        className="inline-flex shrink-0 cursor-help text-slate-400 outline-none hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:text-zinc-300 dark:focus-visible:ring-blue-400/40"
        aria-label={text}
        onPointerEnter={show}
        onPointerLeave={(e) => scheduleClose(e.pointerType === "touch" ? 3000 : 120)}
        onFocus={show}
        onBlur={() => scheduleClose()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            clearCloseTimer();
            setOpen(false);
            setPos(null);
          }
        }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
        </svg>
      </span>
      {tooltip}
    </>
  );
}

function ScoreRow({
  label,
  hint,
  value,
  valueClassName = "text-gray-900 dark:text-white",
}: {
  label: string;
  hint?: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-1 text-sm text-slate-500 dark:text-zinc-500">
        {label}
        {hint ? <InfoHint text={hint} /> : null}
      </span>
      <span className={`shrink-0 text-right text-sm font-bold ${valueClassName}`}>{value}</span>
    </div>
  );
}

function IconAnalytics({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 12l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRocket({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91L16.5 7.5" strokeLinecap="round" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" strokeLinecap="round" />
    </svg>
  );
}

function IconAiSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function IconRadar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" strokeLinecap="round" />
      <path d="m4.93 4.93 1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconHistory({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" />
      <path d="M3 3v5h5M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TickerDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const { symbol } = use(params);
  const { data, isLoading, error } = useTickerDetail(symbol);
  const { data: historyData } = useTickerHistory(symbol);
  const { data: perfData } = useTickerPerformance(symbol);
  const { data: bookmarkedSymbols = new Set<string>() } = useWatchlist();
  const { mutate: toggleWatchlist } = useToggleWatchlist();
  const [activeTab, setActiveTab] = useState<"overview" | "signals" | "history">("overview");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null | undefined>(undefined);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);
  const reportGenerated = useRef(false);
  const { mutate: generateReport, isPending: reportGenerating, isError: reportError, error: reportErrorObj } = useGenerateReport(symbol);

  async function refreshPrice() {
    if (priceRefreshing) return;
    setPriceRefreshing(true);
    try {
      const res = await fetch(`/api/prices?symbols=${symbol}`);
      if (res.ok) {
        const json = await res.json();
        const p = json.prices?.[symbol.toUpperCase()];
        setLivePrice(p ?? null);
        if (p != null) setLastLiveAt(new Date());
      }
    } catch {
      // network error — price stays as scan snapshot
    } finally {
      setPriceRefreshing(false);
    }
  }

  // Auto-generate report if missing
  useEffect(() => {
    if (data?.ticker && !data.ticker.catalyst && !reportGenerated.current && !reportGenerating) {
      reportGenerated.current = true;
      generateReport();
    }
  }, [data?.ticker, generateReport, reportGenerating]);

  // Auto-refresh live price on open / symbol change
  useEffect(() => {
    refreshPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-zinc-400">
        Ticker not found or no data available.
      </div>
    );
  }

  const { ticker, signals } = data;

  const exchangeShort = formatExchangeLabel(ticker.exchange);
  const subtitleParts = [ticker.name?.trim() || null, exchangeShort].filter(Boolean);
  const return1d = ticker.return1d;
  const priceFor52w =
    livePrice !== undefined && livePrice !== null ? livePrice : ticker.price;
  const week52 = week52BarInputs(ticker.wk52Lo, ticker.wk52Hi, priceFor52w);
  const flowLabel = institutionalFlowLabel(ticker.sources);
  const sentimentLabel = sentimentDescriptor(ticker.avgSentiment);

  return (
    <div className="mx-auto min-w-0 w-full max-w-7xl space-y-6">
      <header className="space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to list
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="type-display text-gray-900 dark:text-white">
                {ticker.symbol}
              </h1>
            </div>
            {subtitleParts.length > 0 ? (
              <p className="max-w-2xl text-sm leading-snug text-slate-600 dark:text-zinc-400">{subtitleParts.join(" · ")}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <a
              href={`https://finance.yahoo.com/quote/${ticker.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View on Yahoo Finance"
              className="inline-flex h-9 w-9 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
            >
              <span className="sr-only">Yahoo Finance</span>
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="12" fill="#6001d2" />
                <text x="12" y="16" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="Arial, sans-serif">
                  Y!
                </text>
              </svg>
            </a>
            {session?.user ? (
              <>
                <button
                  type="button"
                  aria-label={bookmarkedSymbols.has(ticker.symbol) ? "Remove bookmark" : "Bookmark ticker"}
                  onClick={() =>
                    toggleWatchlist({ symbol: ticker.symbol, isBookmarked: bookmarkedSymbols.has(ticker.symbol) })
                  }
                  className="inline-flex h-9 w-9 items-center justify-center text-slate-400 transition-colors hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400"
                >
                  {bookmarkedSymbols.has(ticker.symbol) ? (
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPosition(true)}
                  aria-label="Add position"
                  className="inline-flex h-9 w-9 items-center justify-center text-slate-400 transition-colors hover:text-blue-500 dark:text-zinc-500 dark:hover:text-blue-400"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8 12h8" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <a
                  href="/login"
                  title="Sign in to bookmark"
                  className="inline-flex h-9 w-9 items-center justify-center text-slate-400 transition-colors hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  <span className="sr-only">Sign in to bookmark</span>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </a>
                <a
                  href="/login"
                  aria-label="Sign in to add position"
                  className="inline-flex h-9 w-9 items-center justify-center text-slate-400 transition-colors hover:text-blue-500 dark:text-zinc-500 dark:hover:text-blue-400"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8 12h8" strokeLinecap="round" />
                  </svg>
                </a>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-600/25 bg-blue-600/10 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
            <span className="font-semibold text-blue-600/80 dark:text-blue-400/90">Stage</span>
            {ticker.stage}
          </span>
          {ticker.recommendation ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                ticker.recommendation === "Avoid"
                  ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <span
                className={
                  ticker.recommendation === "Avoid"
                    ? "font-semibold text-rose-600/80 dark:text-rose-400/90"
                    : "font-semibold text-emerald-600/80 dark:text-emerald-400/90"
                }
              >
                Rec
              </span>
              {ticker.recommendation}
            </span>
          ) : null}
          {ticker.sector ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:border-[#2a3441] dark:bg-[#161d26] dark:text-zinc-300">
              <span className="font-semibold text-slate-500 dark:text-zinc-500">Sector</span>
              {ticker.sector}
            </span>
          ) : null}
          {ticker.sourceCount >= 2 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              <span className="font-semibold text-emerald-600/80 dark:text-emerald-400/90">Sources</span>
              {ticker.sourceCount}
            </span>
          )}
          {ticker.pndFlags && ticker.pndFlags.length > 0 ? (
            <>
              {ticker.pndFlags.map((flag) => (
                <span
                  key={flag}
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                    flag === "micro_cap_no_catalyst" || flag === "sudden_spike"
                      ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : flag === "only_penny_subs"
                        ? "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                        : flag === "penny_price" || flag === "otc_listing"
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-slate-200 bg-white text-slate-600 dark:border-[#2a3441] dark:bg-[#161d26] dark:text-zinc-400"
                  }`}
                >
                  {flag.replace(/_/g, " ")}
                </span>
              ))}
            </>
          ) : null}
        </div>
      </header>

      <div className={`grid grid-cols-2 gap-0 divide-x divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-[#1e262f] dark:border-[#1e262f] dark:bg-[#12181f] ${ticker.netPremium != null && ticker.netPremium !== 0 ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <div className="flex flex-col gap-0.5 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Live price</p>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-xl font-black tabular-nums text-gray-900 dark:text-white">
              {livePrice !== undefined
                ? livePrice !== null
                  ? `$${livePrice.toFixed(2)}`
                  : "N/A"
                : ticker.price
                  ? `$${ticker.price.toFixed(2)}`
                  : "N/A"}
            </span>
            {return1d != null && (
              <span
                className={`text-xs font-bold tabular-nums ${
                  return1d > 0 ? "text-emerald-500" : return1d < 0 ? "text-rose-500" : "text-slate-500"
                }`}
              >
                {return1d > 0 ? "+" : ""}
                {(return1d * 100).toFixed(1)}%
              </span>
            )}
            <button
              type="button"
              onClick={refreshPrice}
              disabled={priceRefreshing}
              aria-label="Refresh price"
              className="ml-auto text-slate-400 hover:text-slate-600 disabled:opacity-40 dark:hover:text-zinc-300"
            >
              {priceRefreshing ? (
                <Spinner className="h-4 w-4 dark:text-blue-400" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16" strokeLinecap="round" />
                  <path d="M21 3v5h-5M3 21v-5h5" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-500">
            {lastLiveAt ? (
              <>
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                Refreshed {formatTimeAgo(lastLiveAt)}
              </>
            ) : (
              <span>Scan snapshot — refresh for live</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Market cap</p>
          <span className="text-xl font-black tabular-nums text-gray-900 dark:text-white">
            {formatMarketCapCompact(ticker.marketCap)}
          </span>
          <p className="text-[10px] text-slate-500 dark:text-zinc-500">{marketCapTierLabel(ticker.marketCap) ?? "—"}</p>
        </div>
        <div className="flex flex-col gap-0.5 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="flex items-start justify-between gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Opportunity</p>
            <InfoHint text="Early-mover score (0–100). Higher = more pre-consensus, novel, fast-moving setup. Not a return forecast." />
          </div>
          <span className="text-xl font-black text-blue-600 dark:text-blue-400">
            {ticker.opportunityScore}
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-500">/100</span>
          </span>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${ticker.opportunityScore}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="flex items-start justify-between gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              AI confidence
            </p>
            <InfoHint text="Evidence strength from aggregated signals — not expected upside." />
          </div>
          <span className="text-xl font-black text-gray-900 dark:text-white">
            {ticker.aiScore}
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-500">/100</span>
          </span>
          <p className="text-[10px] text-slate-500 dark:text-zinc-500">
            {ticker.signalCount} signal{ticker.signalCount !== 1 ? "s" : ""} · {ticker.sourceCount} source{ticker.sourceCount !== 1 ? "s" : ""}
          </p>
        </div>
        {ticker.netPremium != null && ticker.netPremium !== 0 && (
          <div className="flex flex-col gap-0.5 px-2.5 py-2 sm:px-3 sm:py-2.5">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Net premium</p>
              <InfoHint text="Net options premium flow: call dollar volume minus put dollar volume. Positive = bullish institutional positioning. Call ratio shows what % of total premium is calls." />
            </div>
            <span className={`text-xl font-black ${ticker.netPremium > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {formatNetPremiumCompact(ticker.netPremium)}
            </span>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500">
              {ticker.callPremiumRatio != null ? `${Math.round(ticker.callPremiumRatio * 100)}% calls` : "Options flow"}
            </p>
          </div>
        )}
      </div>

      <div className="grid min-w-0 w-full grid-cols-3 border-b border-slate-200 dark:border-[#1e262f] md:flex md:overflow-x-auto">
        {(["overview", "signals", "history"] as const).map((tab) => {
          const labels: Record<string, string> = {
            overview: "Overview",
            signals: `Signals\u00a0(${signals.length})`,
            history: "History",
          };
          const icons: Record<string, ReactNode> = {
            overview: (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            ),
            signals: <IconRadar className="h-4 w-4 shrink-0" />,
            history: <IconHistory className="h-4 w-4 shrink-0" />,
          };
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              title={labels[tab]}
              className={`-mb-px flex min-w-0 items-center justify-center gap-1 border-b-2 px-2 py-2.5 text-center text-xs font-semibold transition-colors md:shrink-0 md:justify-start md:gap-2 md:px-5 md:py-3 md:text-left md:text-sm ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {icons[tab]}
              <span className="min-w-0 truncate">{labels[tab]}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#1e262f] dark:bg-[#12181f]">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-zinc-100">
                <IconAnalytics className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Price &amp; scores
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-[#1e262f]">
                {week52 ? (
                  <Week52PositionRow
                    lo={week52.lo}
                    hi={week52.hi}
                    price={week52.price}
                    hint="Dot is the current price (live quote when loaded, otherwise last scan) between 52-week low and high. Not RSI or strength vs the broad market."
                  />
                ) : (
                  <ScoreRow
                    label="52-week range"
                    hint="52-week low and high with current price on the range when data is available. Not RSI or strength vs the broad market."
                    value="—"
                  />
                )}
                <ScoreRow
                  label="Source mix"
                  hint="Heuristic from which feeds contributed (e.g. SEC, Congress, options). Not order flow or institutional dollars."
                  value={flowLabel}
                  valueClassName={flowValueClass(flowLabel)}
                />
                <ScoreRow
                  label="Social sentiment"
                  hint="Average sentiment from parsed social signals in this scan when text sentiment is available."
                  value={sentimentLabel}
                  valueClassName={
                    sentimentLabel === "Bullish"
                      ? "text-blue-600 dark:text-blue-400"
                      : sentimentLabel === "Bearish"
                        ? "text-rose-500"
                        : "text-gray-900 dark:text-white"
                  }
                />
                <ScoreRow
                  label="Mention velocity"
                  hint="Velocity score from the harvest pipeline (social signal activity), when computed."
                  value={ticker.avgVelocity != null ? `${ticker.avgVelocity.toFixed(1)}×` : "—"}
                />
                {ticker.netPremium != null && ticker.netPremium !== 0 && (
                  <ScoreRow
                    label="Net premium flow"
                    hint="Call dollar volume minus put dollar volume from options chains. Positive = bullish institutional positioning. Shows call premium ratio as a percentage."
                    value={`${formatNetPremiumCompact(ticker.netPremium)}${ticker.callPremiumRatio != null ? ` (${Math.round(ticker.callPremiumRatio * 100)}% calls)` : ""}`}
                    valueClassName={
                      ticker.netPremium > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }
                  />
                )}
              </div>
            </div>

            {perfData?.latest && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-6 dark:border-[#1e262f] dark:bg-[#12181f]">
                <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-zinc-100">Price performance</h3>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { label: "1 Day", value: perfData.latest.return1d },
                    { label: "3 Day", value: perfData.latest.return3d },
                    { label: "7 Day", value: perfData.latest.return7d },
                    { label: "30 Day", value: perfData.latest.return30d },
                  ] as const).map((item) => (
                    <div key={item.label} className="rounded-lg bg-slate-50 p-3 dark:bg-[#1e262f]/30">
                      <p className="mb-1 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-500">
                        {item.label}
                      </p>
                      <p
                        className={`text-lg font-bold tabular-nums ${
                          item.value == null
                            ? "text-slate-300 dark:text-zinc-600"
                            : item.value > 0
                              ? "text-emerald-500"
                              : item.value < 0
                                ? "text-rose-500"
                                : "text-gray-700 dark:text-zinc-300"
                        }`}
                      >
                        {item.value != null
                          ? `${item.value > 0 ? "+" : ""}${(item.value * 100).toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[10px] text-slate-500 dark:text-zinc-500">
                  Initial detection at ${perfData.latest.detectionPrice.toFixed(2)} on{" "}
                  {new Date(perfData.latest.validatedTicker.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6 lg:col-span-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl border border-blue-600/20 bg-blue-600/5 p-6 dark:border-blue-500/25 dark:bg-blue-500/5">
                <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-10">
                  <IconRocket className="h-16 w-16 text-blue-600" />
                </div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path d="M23 6l-9.5 9.5-5-5L1 18" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M17 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Thesis
                </h4>
                {reportGenerating ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                    <Spinner className="h-4 w-4" />
                    Generating…
                  </div>
                ) : reportError && (reportErrorObj?.message?.includes("subscription") || reportErrorObj?.message?.includes("Sign in")) ? (
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                    {session?.user ? (
                      <>AI analysis requires a Pro subscription.{" "}
                      <a href="/subscription" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        Upgrade to Pro
                      </a>{" "}
                      to generate reports for any ticker.</>
                    ) : (
                      <><a href="/login" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        Sign in
                      </a>{" "}
                      to unlock AI-generated analysis for this ticker.</>
                    )}
                  </p>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                      {ticker.catalyst || (reportError ? "AI analysis unavailable." : "No catalyst data available.")}
                    </p>
                    {ticker.catalyst && signals.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-blue-600/10 pt-3">
                        {signals
                          .filter((s) => !s.pndFlagged)
                          .slice(0, 3)
                          .map((s) => (
                            <li key={s.id} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-zinc-400">
                              <span className="mt-0.5 shrink-0 text-blue-400">·</span>
                              <span className="min-w-0 truncate">
                                {s.url && /^https?:\/\//.test(s.url) ? (
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    {s.title || s.source}
                                  </a>
                                ) : (
                                  s.title || s.source
                                )}
                                {s.upvotes != null && (
                                  <span className="ml-1 text-slate-400 dark:text-zinc-500">{s.upvotes}↑</span>
                                )}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 dark:border-amber-500/25 dark:bg-amber-500/5">
                <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-10">
                  <svg className="h-16 w-16 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  </svg>
                </div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  Risks
                </h4>
                {ticker.risks ? (
                  <>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{ticker.risks}</p>
                    {signals.some((s) => s.pndFlagged) && (
                      <ul className="mt-3 space-y-1 border-t border-amber-500/10 pt-3">
                        {signals
                          .filter((s) => s.pndFlagged)
                          .slice(0, 3)
                          .map((s) => (
                            <li key={s.id} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-zinc-400">
                              <span className="mt-0.5 shrink-0 text-amber-400">·</span>
                              <span className="min-w-0 truncate">
                                {s.title || s.source}
                                {s.pndFlags.length > 0 && (
                                  <span className="ml-1 text-amber-500">{s.pndFlags[0].replace(/_/g, " ")}</span>
                                )}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </>
                ) : reportError && (reportErrorObj?.message?.includes("subscription") || reportErrorObj?.message?.includes("Sign in")) ? (
                  <p className="text-sm text-slate-600 dark:text-zinc-400">
                    {session?.user ? (
                      <>Risk analysis requires a Pro subscription.{" "}
                      <a href="/subscription" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        Upgrade to Pro
                      </a></>
                    ) : (
                      <><a href="/login" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        Sign in
                      </a>{" "}to unlock AI-generated risk analysis.</>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-zinc-500">No risk summary yet.</p>
                )}
              </div>
            </div>

            <TradeSetupCard ticker={ticker} />

            {(ticker.report || reportGenerating) && (
              <div
                id="ticker-ai-analysis"
                className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#1e262f] dark:bg-[#12181f]"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400">
                    <IconAiSparkles className="h-4 w-4" />
                    AI Technical Analysis
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Based on scan data from{" "}
                    {new Date(ticker.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {reportGenerating ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-slate-600 dark:text-zinc-400">
                    <Spinner className="h-4 w-4" />
                    Generating full report…
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ticker.report!.split("\n").filter(Boolean).map((paragraph, i) => {
                      const match = paragraph.match(/^\*\*([^*]+)\*\*\s*[—–-]?\s*([\s\S]*)/);
                      if (match) {
                        return (
                          <p key={i} className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                            <span className="font-semibold text-slate-900 dark:text-zinc-100">{match[1]}</span>
                            {match[2] ? ` — ${match[2]}` : ""}
                          </p>
                        );
                      }
                      return (
                        <p key={i} className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{paragraph}</p>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "signals" && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1e262f] dark:bg-[#12181f]">
          {signals.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 dark:text-zinc-400">No signals recorded for this ticker.</p>
          ) : (
            <div className="space-y-3 p-4">
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-[#1e262f] dark:bg-[#1e262f]/20"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                        {signal.title ? (
                          signal.url && /^https?:\/\//.test(signal.url) ? (
                            <a
                              href={signal.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {signal.title}
                            </a>
                          ) : (
                            signal.title
                          )
                        ) : (
                          signal.source
                        )}
                      </h5>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="rounded bg-blue-600/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          {formatSource(signal.source)}
                        </span>
                        {signal.pndFlagged ? (
                          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-500">
                            P&amp;D flagged
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">
                            clean
                          </span>
                        )}
                        {signal.pndFlags.length > 0 && signal.pndFlagged && (
                          <span className="rounded bg-rose-500/5 px-2 py-0.5 text-[10px] text-rose-400">
                            {signal.pndFlags[0].replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 flex-col items-end gap-1 text-right">
                    <div className="flex items-center gap-2">
                      {signal.upvotes != null && (
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                          <span className="font-bold">{signal.upvotes}</span>↑
                        </span>
                      )}
                      {signal.commentCount != null && signal.commentCount > 0 && (
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                          <span className="font-bold">{signal.commentCount}</span> 💬
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500">
                      {new Date(signal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#1e262f] dark:bg-[#12181f]">
          {!historyData ? (
            <div className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">Loading history…</div>
          ) : historyData.history.length <= 1 ? (
            <div className="py-2">
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Tracking begins here.</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                This ticker appeared in its first scan. History and score trends build automatically as it continues to surface in future scans.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-1 py-1 dark:border-zinc-800/80 dark:bg-zinc-900/35">
                <Sparkline
                  points={historyData.history.map((h) => ({
                    score: h.aiScore,
                    stage: h.stage,
                    date: new Date(h.startedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }),
                  }))}
                />
              </div>
              {(() => {
                const reversed = [...historyData.history].reverse();
                const stageOrder: Record<string, number> = { CONFIRMED: 3, FORMING: 2, EARLY: 1, FILTERED: 0 };
                const grouped = reversed.reduce<
                  { dateKey: string; label: string; best: typeof reversed[0]; entries: typeof reversed }[]
                >((acc, h) => {
                  const dateKey = new Date(h.startedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  let group = acc.find((g) => g.dateKey === dateKey);
                  if (!group) {
                    group = { dateKey, label: dateKey, best: h, entries: [] };
                    acc.push(group);
                  }
                  group.entries.push(h);
                  if (
                    h.aiScore > group.best.aiScore ||
                    (h.aiScore === group.best.aiScore &&
                      (stageOrder[h.stage] ?? 0) > (stageOrder[group.best.stage] ?? 0))
                  ) {
                    group.best = h;
                  }
                  return acc;
                }, []);

                const INITIAL_DAYS = 7;
                const visibleGroups = showAllHistory ? grouped : grouped.slice(0, INITIAL_DAYS);
                const hasMore = grouped.length > INITIAL_DAYS;

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
                          <th className="pb-2 pr-4 font-medium">Date</th>
                          <th className="pb-2 pr-4 font-medium">Best Score</th>
                          <th className="pb-2 pr-4 font-medium">Stage</th>
                          <th className="pb-2 pr-4 font-medium">Price</th>
                          <th className="pb-2 font-medium">Scans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleGroups.map((group) => {
                          const isExpanded = expandedDates.has(group.dateKey);
                          const hasMultiple = group.entries.length > 1;
                          return (
                            <Fragment key={group.dateKey}>
                              <tr
                                className={`border-b border-gray-50 dark:border-zinc-800/80 ${hasMultiple ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/50" : ""}`}
                                onClick={
                                  hasMultiple
                                    ? () =>
                                        setExpandedDates((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(group.dateKey)) next.delete(group.dateKey);
                                          else next.add(group.dateKey);
                                          return next;
                                        })
                                    : undefined
                                }
                              >
                                <td className="py-1.5 pr-4 text-gray-600 dark:text-zinc-300">
                                  {group.label}
                                </td>
                                <td className="py-1.5 pr-4 font-semibold text-blue-600 dark:text-blue-400">
                                  {group.best.aiScore}
                                </td>
                                <td className="py-1.5 pr-4">
                                  <Badge
                                    variant={
                                      group.best.stage === "Emerging"
                                        ? "success"
                                        : group.best.stage === "Building"
                                          ? "warning"
                                          : group.best.stage === "Consensus"
                                            ? "info"
                                            : "info"
                                    }
                                  >
                                    {group.best.stage}
                                  </Badge>
                                </td>
                                <td className="py-1.5 pr-4 text-gray-600 dark:text-zinc-300">
                                  {group.best.price ? `$${group.best.price.toFixed(2)}` : "—"}
                                </td>
                                <td className="py-1.5 text-gray-500 dark:text-zinc-500">
                                  {hasMultiple ? (
                                    <span className="inline-flex items-center gap-1">
                                      {group.entries.length}
                                      <svg
                                        className={`h-3 w-3 transition-transform duration-fast ${isExpanded ? "rotate-180" : ""}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </span>
                                  ) : (
                                    "1"
                                  )}
                                </td>
                              </tr>
                              {isExpanded &&
                                group.entries.map((h) => (
                                  <tr
                                    key={h.scanId}
                                    className="border-b border-gray-50 bg-gray-50/50 dark:border-zinc-800/80 dark:bg-zinc-900/40"
                                  >
                                    <td className="py-1 pr-4 pl-4 text-xs text-gray-400 dark:text-zinc-500">
                                      {new Date(h.startedAt).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </td>
                                    <td className="py-1 pr-4 text-sm text-blue-500 dark:text-blue-400">
                                      {h.aiScore}
                                    </td>
                                    <td className="py-1 pr-4">
                                      <Badge
                                        variant={
                                          h.stage === "Emerging"
                                            ? "success"
                                            : h.stage === "Building"
                                              ? "warning"
                                              : h.stage === "Consensus"
                                                ? "info"
                                                : "info"
                                        }
                                      >
                                        {h.stage}
                                      </Badge>
                                    </td>
                                    <td className="py-1 pr-4 text-xs text-gray-500 dark:text-zinc-400">
                                      {h.price ? `$${h.price.toFixed(2)}` : "—"}
                                    </td>
                                    <td />
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setShowAllHistory((v) => !v)}
                        className="mt-3 w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {showAllHistory
                          ? "Show recent only"
                          : `Show all ${grouped.length} days`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {session?.user && showAddPosition && (
        <AddPositionModal
          symbol={ticker.symbol}
          onClose={() => setShowAddPosition(false)}
        />
      )}
    </div>
  );
}
