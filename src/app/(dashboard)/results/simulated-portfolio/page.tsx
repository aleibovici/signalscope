"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePaperTrades, useAlphaCurve, type PaperTrade, type AlphaPoint } from "@/hooks/use-paper-trading";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const LOOKBACK_OPTIONS = [
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];
const SCORE_OPTIONS = [60, 70, 80, 90];

const selectClass =
  "h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:focus:ring-blue-400";

function formatPct(value: number, minDecimals = 1): string {
  const pct = value * 100;
  const decimals = Math.abs(pct) < 0.05 && pct !== 0 ? Math.max(minDecimals, 2) : minDecimals;
  return `${value > 0 ? "+" : ""}${pct.toFixed(decimals)}%`;
}

function formatPp(pp: number): string {
  return `${pp >= 0 ? "+" : ""}${pp.toFixed(1)} pp`;
}

function formatUsd(value: number, decimals = 2): string {
  if (value === 0) return "$0.00";
  const sign = value > 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(decimals)}`;
}

function formatLegNotional(n: number): string {
  if (n >= 1000 && n % 1000 === 0) return `$${n / 1000}k`;
  return `$${n.toLocaleString()}`;
}

function formatPrice(value: number): string {
  return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

type SortKey = "returnPct" | "aiScore" | "detectedAt" | "closingAt" | "symbol" | "pnl";

function formatSortValue(key: SortKey, dir: "asc" | "desc"): string {
  return `${key}:${dir}`;
}

function parseSortValue(v: string): { key: SortKey; dir: "asc" | "desc" } | null {
  const i = v.lastIndexOf(":");
  if (i <= 0) return null;
  const key = v.slice(0, i) as SortKey;
  const dir = v.slice(i + 1);
  if (dir !== "asc" && dir !== "desc") return null;
  return { key, dir };
}

function mobileSortSelectOptions(params: {
  showExitDate: boolean;
  showDetectedColumn: boolean;
}): { value: string; label: string }[] {
  const rows: { value: string; label: string }[] = [
    { value: "returnPct:desc", label: "Return (high first)" },
    { value: "returnPct:asc", label: "Return (low first)" },
    { value: "pnl:desc", label: "P&L (high first)" },
    { value: "pnl:asc", label: "P&L (low first)" },
    { value: "aiScore:desc", label: "AI score (high first)" },
    { value: "aiScore:asc", label: "AI score (low first)" },
    { value: "symbol:asc", label: "Symbol (A–Z)" },
    { value: "symbol:desc", label: "Symbol (Z–A)" },
  ];
  if (params.showDetectedColumn) {
    rows.push(
      { value: "detectedAt:desc", label: "Detected (newest)" },
      { value: "detectedAt:asc", label: "Detected (oldest)" },
    );
  }
  if (params.showExitDate) {
    rows.push(
      { value: "closingAt:desc", label: "Exit date (newest)" },
      { value: "closingAt:asc", label: "Exit date (oldest)" },
    );
  }
  return rows;
}

function sortTrades(list: PaperTrade[], sortBy: SortKey, sortDir: "asc" | "desc") {
  return [...list].sort((a, b) => {
    const dir = sortDir === "desc" ? -1 : 1;
    switch (sortBy) {
      case "returnPct":
        return dir * ((a.returnPct ?? -999) - (b.returnPct ?? -999));
      case "aiScore":
        return dir * (a.aiScore - b.aiScore);
      case "pnl":
        return dir * ((a.pnl ?? -999) - (b.pnl ?? -999));
      case "detectedAt":
        return dir * ((a.detectedAtMs ?? 0) - (b.detectedAtMs ?? 0));
      case "closingAt":
        return dir * ((a.closingAtMs ?? 0) - (b.closingAtMs ?? 0));
      case "symbol":
        return dir * a.symbol.localeCompare(b.symbol);
      default:
        return 0;
    }
  });
}

export default function PaperTradingPage() {
  const [lookbackDays, setLookbackDays] = useState(14);
  const [minScore, setMinScore] = useState(70);
  const [positionSize, setPositionSize] = useState(1000);

  const { data, isLoading, error } = usePaperTrades({ minScore, lookbackDays });
  const alphaCurve = useAlphaCurve(minScore);

  const { openTrades, closedTrades } = useMemo(() => {
    if (!data) return { openTrades: [], closedTrades: [] };
    return {
      openTrades: data.trades.filter((t) => t.status === "OPEN"),
      closedTrades: data.trades.filter((t) => t.status === "CLOSED"),
    };
  }, [data]);

  const scaledSummary = useMemo(() => {
    if (!data) return null;
    const scale = positionSize / data.summary.positionSize;
    return {
      ...data.summary,
      totalPnl: data.summary.totalPnl * scale,
      positionSize,
    };
  }, [data, positionSize]);

  const totalPnlFromLines = useMemo(() => {
    if (!data?.trades) return 0;
    return data.trades.reduce(
      (sum, t) => (t.returnPct !== null ? sum + positionSize * t.returnPct : sum),
      0,
    );
  }, [data, positionSize]);

  const peakCapital = useMemo(() => {
    if (!data?.trades.length) return { amount: 0, legs: 0 };
    // For open trades, use detection + 7d as a stable stand-in for "still open"
    const events: { ms: number; delta: number }[] = [];
    for (const t of data.trades) {
      events.push({ ms: t.detectedAtMs, delta: 1 });
      const closeMs = t.closingAtMs ?? t.detectedAtMs + 7 * 86400000;
      events.push({ ms: closeMs, delta: -1 });
    }
    events.sort((a, b) => a.ms - b.ms || a.delta - b.delta);
    let cur = 0;
    let max = 0;
    for (const e of events) {
      cur += e.delta;
      if (cur > max) max = cur;
    }
    return { amount: max * positionSize, legs: max };
  }, [data, positionSize]);

  const spyBenchmarkSub = useMemo(() => {
    if (!data?.benchmark) return "";
    const b = data.benchmark;
    if (b.matchedReturnPct === null && b.returnPct === null) return "Unavailable";
    if (scaledSummary && scaledSummary.tradesWithMark > 0 && b.matchedReturnPct !== null) {
      const pp = (scaledSummary.avgReturn - b.matchedReturnPct) * 100;
      return `${formatPp(pp)} vs avg`;
    }
    return "SPY, hold-matched avg";
  }, [data, scaledSummary]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl dark:text-zinc-100">
          Paper Trading
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-gray-500 dark:text-zinc-400">
          Simulated trades from signals detected in the last {lookbackDays} day{lookbackDays !== 1 ? "s" : ""} — see what would happen if you followed
          every call
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 w-full sm:w-auto">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">
            Lookback
          </label>
          <select
            value={lookbackDays}
            onChange={(e) => setLookbackDays(Number(e.target.value))}
            className={`${selectClass} h-11 w-full min-w-0 touch-manipulation sm:h-10 sm:w-auto sm:min-w-36`}
          >
            {LOOKBACK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 w-full sm:w-auto">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">
            Min AI Score
          </label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className={`${selectClass} h-11 w-full min-w-0 touch-manipulation sm:h-10 sm:w-auto sm:min-w-36`}
          >
            {SCORE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}+
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 w-full sm:w-auto">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">
            Position Size
          </label>
          <select
            value={positionSize}
            onChange={(e) => setPositionSize(Number(e.target.value))}
            className={`${selectClass} h-11 w-full min-w-0 touch-manipulation sm:h-10 sm:w-auto sm:min-w-36`}
          >
            {[500, 1000, 2500, 5000, 10000].map((s) => (
              <option key={s} value={s}>
                ${s.toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
      )}

      {error && (
        <p className="text-center text-gray-500 dark:text-zinc-400">
          Failed to load paper trading data.
        </p>
      )}

      {data && scaledSummary && (
        <>
          <section
            aria-label="Paper trading summary"
            className="rounded-2xl border border-gray-200/90 bg-linear-to-b from-gray-50/95 to-white p-2 shadow-sm sm:p-3 dark:border-zinc-800 dark:from-zinc-900/80 dark:to-[#12181f]"
          >
            <div className="grid grid-cols-2 gap-2 *:min-w-0 [&>:last-child]:col-span-2 sm:[&>:last-child]:col-span-1 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-7 lg:gap-2">
              <SummaryCard
                label="Total trades"
                value={String(scaledSummary.totalTrades)}
                sub={`${scaledSummary.openTrades} · ${scaledSummary.closedTrades}`}
                subHint="Open · closed"
              />
              <SummaryCard
                label="Win rate"
                value={
                  scaledSummary.tradesWithMark > 0
                    ? `${(scaledSummary.winRate * 100).toFixed(0)}%`
                    : "--"
                }
                sub="with mark"
              />
              <SummaryCard
                label="Avg hold"
                value={scaledSummary.avgHoldDays !== null ? `${scaledSummary.avgHoldDays.toFixed(1)}d` : "--"}
                sub="1d / 3d / 7d"
              />
              <SummaryCard
                label="Avg return"
                value={
                  scaledSummary.tradesWithMark > 0 ? formatPct(scaledSummary.avgReturn) : "--"
                }
                valueColor={
                  scaledSummary.tradesWithMark === 0
                    ? undefined
                    : scaledSummary.avgReturn > 0
                      ? "green"
                      : scaledSummary.avgReturn < 0
                        ? "red"
                        : undefined
                }
                sub={
                  scaledSummary.tradesWithMark > 0
                    ? `eq. weight · n=${scaledSummary.tradesWithMark}`
                    : "no marks"
                }
              />
              <SummaryCard
                label="S&P 500"
                value={
                  data.benchmark.matchedReturnPct !== null
                    ? formatPct(data.benchmark.matchedReturnPct)
                    : data.benchmark.returnPct !== null
                      ? formatPct(data.benchmark.returnPct)
                      : "--"
                }
                valueColor={
                  (data.benchmark.matchedReturnPct ?? data.benchmark.returnPct) === null
                    ? undefined
                    : (data.benchmark.matchedReturnPct ?? data.benchmark.returnPct)! > 0
                      ? "green"
                      : (data.benchmark.matchedReturnPct ?? data.benchmark.returnPct)! < 0
                        ? "red"
                        : undefined
                }
                sub={spyBenchmarkSub}
                subHint="SPY avg return, matched to each trade's hold period"
              />
              <SummaryCard
                label="Total P&L"
                value={
                  scaledSummary.tradesWithMark > 0
                    ? formatUsd(totalPnlFromLines)
                    : "--"
                }
                valueColor={
                  scaledSummary.tradesWithMark === 0
                    ? undefined
                    : totalPnlFromLines > 0
                      ? "green"
                      : totalPnlFromLines < 0
                        ? "red"
                        : undefined
                }
                sub={
                  scaledSummary.tradesWithMark < scaledSummary.totalTrades
                    ? `${formatLegNotional(positionSize)}/leg · ${scaledSummary.tradesWithMark}/${scaledSummary.totalTrades}`
                    : `${formatLegNotional(positionSize)}/leg · ${scaledSummary.tradesWithMark}`
                }
              />
              <SummaryCard
                label="Peak Capital"
                value={`$${peakCapital.amount.toLocaleString()}`}
                sub={`${peakCapital.legs} × ${formatLegNotional(positionSize)} max`}
                subHint="Most positions open at the same time"
              />
            </div>
          </section>

          <AlphaCurveChart points={alphaCurve.points} isLoading={alphaCurve.isLoading} positionSize={positionSize} />

          <TradesTable
            title="Open Positions"
            description={`${openTrades.length} trades still inside the 7-calendar-day hold — MTM uses the best filled snapshot up to the exit (1d / 3d / 7d), same as the eventual exit price.`}
            trades={openTrades}
            positionSize={positionSize}
            priceLabel="Latest"
            emptyMessage="No open positions."
            initialSort={{ key: "detectedAt", dir: "desc" }}
          />

          <TradesTable
            title="Closed Positions"
            description={`${closedTrades.length} trades past the 7-calendar-day exit — P&L is the ~1 week snapshot (7d → 3d → 1d if 7d missing). We do not extend the hold to 30d. Summary cards use open + closed rows that have a mark.`}
            trades={closedTrades}
            positionSize={positionSize}
            priceLabel="Exit"
            emptyMessage="No closed positions yet."
            initialSort={{ key: "closingAt", dir: "desc" }}
            showExitDate
            showDetectedColumn={false}
          />

        </>
      )}
    </div>
  );
}

function TradesTable({
  title,
  description,
  trades,
  positionSize,
  priceLabel,
  emptyMessage,
  initialSort = { key: "returnPct" as SortKey, dir: "desc" as const },
  showExitDate = false,
  showDetectedColumn = true,
}: {
  title: string;
  description: string;
  trades: PaperTrade[];
  positionSize: number;
  priceLabel: string;
  emptyMessage: string;
  initialSort?: { key: SortKey; dir: "asc" | "desc" };
  showExitDate?: boolean;
  showDetectedColumn?: boolean;
}) {
  const [sortBy, setSortBy] = useState<SortKey>(initialSort.key);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSort.dir);

  const sorted = useMemo(
    () => sortTrades(trades, sortBy, sortDir),
    [trades, sortBy, sortDir],
  );

  const sortSelectOptions = useMemo(
    () => mobileSortSelectOptions({ showExitDate, showDetectedColumn }),
    [showExitDate, showDetectedColumn],
  );

  const sortSelectValue = formatSortValue(sortBy, sortDir);
  const sortSelectValueSafe = sortSelectOptions.some((o) => o.value === sortSelectValue)
    ? sortSelectValue
    : sortSelectOptions[0]?.value ?? sortSelectValue;

  const { pnlSubtotal, markedInTable } = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const t of trades) {
      if (t.returnPct !== null) {
        sum += positionSize * t.returnPct;
        count += 1;
      }
    }
    return { pnlSubtotal: sum, markedInTable: count };
  }, [trades, positionSize]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(col: SortKey) {
    if (sortBy !== col) return "\u00a0\u2195";
    return sortDir === "desc" ? "\u00a0\u2193" : "\u00a0\u2191";
  }

  return (
    <Card>
      <CardHeader className="px-3! py-3! sm:px-4! md:px-6! md:py-4!">
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
        <p className="text-pretty text-[11px] leading-relaxed text-gray-400 sm:text-xs dark:text-zinc-500">
          {description}
        </p>
        <div className="mt-3 md:hidden">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">
            Sort list
          </label>
          <select
            value={sortSelectValueSafe}
            onChange={(e) => {
              const parsed = parseSortValue(e.target.value);
              if (parsed) {
                setSortBy(parsed.key);
                setSortDir(parsed.dir);
              }
            }}
            className={`${selectClass} h-11 w-full touch-manipulation`}
            aria-label="Sort trades"
          >
            {sortSelectOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-3 px-3 pb-4 md:hidden">
          {sorted.map((t) => (
            <TradeMobileCard
              key={`${t.symbol}-${t.detectedAt}`}
              trade={t}
              positionSize={positionSize}
              priceLabel={priceLabel}
              showExitDate={showExitDate}
              showDetectedColumn={showDetectedColumn}
            />
          ))}
          {sorted.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{emptyMessage}</p>
          )}
          {sorted.length > 0 && markedInTable > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400">
                Subtotal ({markedInTable} with P&L)
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  pnlSubtotal > 0
                    ? "text-green-600 dark:text-green-400"
                    : pnlSubtotal < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-700 dark:text-zinc-200"
                }`}
              >
                {formatUsd(pnlSubtotal)}
              </span>
            </div>
          )}
        </div>

        <div className="hidden max-h-[450px] touch-pan-x overflow-x-auto overflow-y-auto overscroll-x-contain md:block">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-900">
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggleSort("symbol")}>
                  Symbol{sortIndicator("symbol")}
                </th>
                <th className="cursor-pointer px-3 py-3 font-medium text-right" onClick={() => toggleSort("aiScore")}>
                  AI Score{sortIndicator("aiScore")}
                </th>
                <th className="px-3 py-3 font-medium text-right">Entry</th>
                <th className="px-3 py-3 font-medium text-right">{priceLabel}</th>
                <th className="cursor-pointer px-3 py-3 font-medium text-right" onClick={() => toggleSort("returnPct")}>
                  Return{sortIndicator("returnPct")}
                </th>
                <th className="cursor-pointer px-3 py-3 font-medium text-right" onClick={() => toggleSort("pnl")}>
                  P&L{sortIndicator("pnl")}
                </th>
                <th className="px-3 py-3 font-medium text-center">Hold</th>
                {showExitDate && (
                  <th
                    className="cursor-pointer px-3 py-3 font-medium text-right"
                    onClick={() => toggleSort("closingAt")}
                  >
                    Exit date{sortIndicator("closingAt")}
                  </th>
                )}
                {showDetectedColumn && (
                  <th
                    className="cursor-pointer px-3 py-3 font-medium text-right"
                    onClick={() => toggleSort("detectedAt")}
                  >
                    Detected{sortIndicator("detectedAt")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <TradeRow
                  key={`${t.symbol}-${t.detectedAt}`}
                  trade={t}
                  positionSize={positionSize}
                  showExitDate={showExitDate}
                  showDetectedColumn={showDetectedColumn}
                />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={7 + (showExitDate ? 1 : 0) + (showDetectedColumn ? 1 : 0)}
                    className="py-8 text-center text-gray-400 dark:text-zinc-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {sorted.length > 0 && markedInTable > 0 && (
                <tr className="border-t-2 border-gray-200 bg-gray-50/80 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <td
                    colSpan={5}
                    className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400"
                  >
                    Subtotal ({markedInTable} with P&L)
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right text-sm font-semibold ${
                      pnlSubtotal > 0
                        ? "text-green-600 dark:text-green-400"
                        : pnlSubtotal < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-700 dark:text-zinc-200"
                    }`}
                  >
                    {formatUsd(pnlSubtotal)}
                  </td>
                  <td
                    colSpan={1 + (showExitDate ? 1 : 0) + (showDetectedColumn ? 1 : 0)}
                    className="px-3 py-2.5"
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  subHint,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  subHint?: string;
  valueColor?: "green" | "red";
}) {
  const colorClass =
    valueColor === "green"
      ? "text-green-600 dark:text-green-400"
      : valueColor === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-900 dark:text-zinc-100";

  return (
    <Card
      className="min-w-0 h-full border-gray-200/90 bg-white/90 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-blue-200/70 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-zinc-600"
      title={subHint}
    >
      <CardContent className="flex h-full min-h-25 flex-col items-center justify-between gap-1 px-2! py-3.5 text-center sm:px-3! lg:px-2! lg:py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500">
          {label}
        </p>
        <p
          className={`min-h-8 text-xl font-bold tabular-nums tracking-tight sm:min-h-9 sm:text-2xl ${colorClass}`}
        >
          {value}
        </p>
        <p
          className="line-clamp-2 min-h-8 w-full text-[10px] leading-snug text-gray-400 sm:text-[11px] dark:text-zinc-500"
          title={subHint ? undefined : sub.length > 24 ? sub : undefined}
        >
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Capital growth curve: strategy vs S&P 500 across all lookback periods ── */

const CHART_W = 520;
const CHART_H = 105;
const PAD = { top: 12, right: 20, bottom: 20, left: 42 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

const BASE_CAPITAL = 10_000;
const STRATEGY_COLOR = { light: "#2563eb", dark: "#60a5fa" };
const SPY_COLOR = { light: "#9ca3af", dark: "#71717a" };

function fmtDollarAxis(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtDollarLabel(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function AlphaCurveChart({ points, isLoading, positionSize }: { points: AlphaPoint[]; isLoading: boolean; positionSize: number }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const scale = positionSize / 1000; // API uses $1k default
  const ready = points.filter((p) => p.trades > 0);
  if (isLoading || ready.length < 2) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800/90 dark:bg-[#12181f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-center py-12">
          {isLoading ? (
            <Spinner className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          ) : (
            <p className="text-sm text-gray-400 dark:text-zinc-500">Not enough data for chart</p>
          )}
        </div>
      </div>
    );
  }

  // Build data: starting capital + cumulative P&L at each period
  const strategyVals = [BASE_CAPITAL, ...ready.map((p) => BASE_CAPITAL + p.totalPnl * scale)];
  const spyVals = [BASE_CAPITAL, ...ready.map((p) => BASE_CAPITAL + p.spyTotalPnl * scale)];
  const xLabels = ["0", ...ready.map((p) => p.label)];
  const n = strategyVals.length;

  const allVals = [...strategyVals, ...spyVals];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 100;
  const padV = range * 0.15;
  const yMin = minV - padV;
  const yMax = maxV + padV;

  const stratColor = isDark ? STRATEGY_COLOR.dark : STRATEGY_COLOR.light;
  const spyColor = isDark ? SPY_COLOR.dark : SPY_COLOR.light;
  const gridColor = isDark ? "#3f3f46" : "#f3f4f6";
  const labelColor = isDark ? "#a1a1aa" : "#9ca3af";
  const xLabelColor = isDark ? "#a1a1aa" : "#6b7280";

  function xPos(i: number) {
    return PAD.left + (i / (n - 1)) * PLOT_W;
  }
  function yPos(v: number) {
    return PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;
  }

  // Smooth cubic bezier path (matching sparkline style)
  function buildCurve(vals: number[]): string {
    if (vals.length < 2) return "";
    const pts = vals.map((v, i) => ({ x: xPos(i), y: yPos(v) }));
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const cp1x = pts[i].x + dx * 0.4;
      const cp2x = pts[i + 1].x - dx * 0.4;
      d += ` C ${cp1x},${pts[i].y} ${cp2x},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
  }

  const stratCurve = buildCurve(strategyVals);
  const spyCurve = buildCurve(spyVals);

  // Area fill under strategy line
  const stratAreaPath = stratCurve
    ? `${stratCurve} L ${xPos(n - 1)},${PAD.top + PLOT_H} L ${xPos(0)},${PAD.top + PLOT_H} Z`
    : "";

  // Y-axis ticks
  const yTicks: number[] = [];
  const step = niceStep(yMax - yMin, 5);
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) {
    yTicks.push(v);
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800/90 dark:bg-[#12181f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">
            Capital Growth vs S&P 500
          </h3>
          <div className="flex items-center gap-4 text-[10px] sm:text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: stratColor }} />
              <span className="text-gray-500 dark:text-zinc-400">SignalScope</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: spyColor }} />
              <span className="text-gray-500 dark:text-zinc-400">S&P 500</span>
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Cumulative P&L from {fmtDollarAxis(BASE_CAPITAL)} base — same trades deployed to SPY for comparison
        </p>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        style={{ overflow: "visible" }}
        role="img"
        aria-label="Capital growth chart: strategy vs S&P 500"
      >
        <defs>
          <linearGradient id="alpha-strat-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stratColor} stopOpacity={isDark ? "0.22" : "0.12"} />
            <stop offset="100%" stopColor={stratColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v) => (
          <line
            key={v}
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={yPos(v)}
            y2={yPos(v)}
            stroke={gridColor}
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v) => (
          <text
            key={v}
            x={PAD.left - 8}
            y={yPos(v)}
            textAnchor="end"
            dominantBaseline="central"
            fill={labelColor}
            fontSize="5"
          >
            {fmtDollarAxis(v)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((label, i) => (
          <text
            key={label}
            x={xPos(i)}
            y={CHART_H - 5}
            textAnchor="middle"
            fill={xLabelColor}
            fontSize="5.5"
            fontWeight="500"
          >
            {label}
          </text>
        ))}

        {/* Strategy area fill */}
        {stratAreaPath && <path d={stratAreaPath} fill="url(#alpha-strat-fill)" />}

        {/* SPY line — smooth bezier, dashed */}
        <path
          d={spyCurve}
          fill="none"
          stroke={spyColor}
          strokeWidth={0.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3,2.5"
        />

        {/* Strategy line — smooth bezier, solid */}
        <path
          d={stratCurve}
          fill="none"
          stroke={stratColor}
          strokeWidth={0.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive data points (skip index 0 = starting point) */}
        {strategyVals.map((sv, i) => {
          const isHovered = hoveredIdx === i;
          const isLast = i === n - 1;
          const isStart = i === 0;
          const showLabel = isHovered || isLast;
          const stratY = yPos(sv);
          const spyY = yPos(spyVals[i]);
          const xP = xPos(i);
          const labelGap = Math.abs(stratY - spyY);
          const stratAbove = sv >= spyVals[i];
          const stratLabelY = stratAbove ? stratY - 9 : stratY + 14;
          const spyLabelY = stratAbove
            ? (labelGap < 16 ? spyY + 14 : spyY + 12)
            : (labelGap < 16 ? spyY - 9 : spyY - 9);

          return (
            <g key={`pt-${i}`}>
              {/* Hover column */}
              {isHovered && (
                <line
                  x1={xP}
                  x2={xP}
                  y1={PAD.top}
                  y2={PAD.top + PLOT_H}
                  stroke={isDark ? "#3f3f46" : "#e5e7eb"}
                  strokeWidth={1}
                />
              )}

              {/* Strategy dot */}
              {showLabel && (
                <circle cx={xP} cy={stratY} r={isHovered ? 4 : 2.5} fill={stratColor} fillOpacity="0.15" />
              )}
              <circle
                cx={xP}
                cy={stratY}
                r={showLabel ? 2 : 1.5}
                fill={stratColor}
                stroke={isDark ? "#12181f" : "white"}
                strokeWidth="0.75"
              />

              {/* SPY dot */}
              {showLabel && (
                <circle cx={xP} cy={spyY} r={isHovered ? 4 : 2.5} fill={spyColor} fillOpacity="0.15" />
              )}
              <circle
                cx={xP}
                cy={spyY}
                r={showLabel ? 2 : 1.5}
                fill={spyColor}
                stroke={isDark ? "#12181f" : "white"}
                strokeWidth="0.75"
              />

              {/* Value labels */}
              {showLabel && !isStart && (
                <>
                  <text
                    x={xP}
                    y={stratLabelY}
                    textAnchor={isLast ? "end" : "middle"}
                    fill={stratColor}
                    fontSize="5.5"
                    fontWeight="600"
                    letterSpacing="0.02em"
                  >
                    {fmtDollarLabel(sv)}
                  </text>
                  <text
                    x={xP}
                    y={spyLabelY}
                    textAnchor={isLast ? "end" : "middle"}
                    fill={spyColor}
                    fontSize="5.5"
                    fontWeight="500"
                    letterSpacing="0.02em"
                  >
                    {fmtDollarLabel(spyVals[i])}
                  </text>
                </>
              )}

              {/* Hit area for hover */}
              <rect
                x={i === 0 ? xP : xP - PLOT_W / (n * 2)}
                y={PAD.top}
                width={i === 0 ? PLOT_W / (n * 2) : PLOT_W / n}
                height={PLOT_H}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function niceStep(range: number, maxTicks: number): number {
  const rough = range / maxTicks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function TradeMobileCard({
  trade: t,
  positionSize,
  priceLabel,
  showExitDate = false,
  showDetectedColumn = true,
}: {
  trade: PaperTrade;
  positionSize: number;
  priceLabel: string;
  showExitDate?: boolean;
  showDetectedColumn?: boolean;
}) {
  const scaledPnl = t.returnPct !== null ? positionSize * t.returnPct : null;
  const returnColor =
    t.returnPct !== null && t.returnPct > 0
      ? "text-green-600 dark:text-green-400"
      : t.returnPct !== null && t.returnPct < 0
        ? "text-red-600 dark:text-red-400"
        : "text-gray-500 dark:text-zinc-400";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/ticker/${t.symbol}`}
            className="text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {t.symbol}
          </Link>
          {t.name ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-500 dark:text-zinc-400">
              {t.name}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">AI {t.aiScore}</p>
          <p className={`mt-1 text-sm font-semibold tabular-nums ${returnColor}`}>
            {t.returnPct !== null ? formatPct(t.returnPct) : "—"}
          </p>
          <p className={`text-xs font-medium tabular-nums ${returnColor}`}>
            {scaledPnl !== null ? formatUsd(scaledPnl) : "—"}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-gray-500 dark:text-zinc-500">Entry</dt>
        <dd className="text-right font-medium tabular-nums text-gray-800 dark:text-zinc-200">
          {formatPrice(t.entryPrice)}
        </dd>
        <dt className="text-gray-500 dark:text-zinc-500">{priceLabel}</dt>
        <dd className="text-right font-medium tabular-nums text-gray-800 dark:text-zinc-200">
          {t.exitPrice !== null ? formatPrice(t.exitPrice) : "—"}
        </dd>
        <dt className="text-gray-500 dark:text-zinc-500">Hold</dt>
        <dd className="text-right font-medium tabular-nums text-gray-800 dark:text-zinc-200">
          {t.holdDays ?? "—"}
        </dd>
        {showExitDate && (
          <>
            <dt className="text-gray-500 dark:text-zinc-500">Exit date</dt>
            <dd className="text-right text-gray-700 dark:text-zinc-300">{t.closingAt ?? "—"}</dd>
          </>
        )}
        {showDetectedColumn && (
          <>
            <dt className="text-gray-500 dark:text-zinc-500">Detected</dt>
            <dd className="text-right text-gray-700 dark:text-zinc-300">{t.detectedAt}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function TradeRow({
  trade: t,
  positionSize,
  showExitDate = false,
  showDetectedColumn = true,
}: {
  trade: PaperTrade;
  positionSize: number;
  showExitDate?: boolean;
  showDetectedColumn?: boolean;
}) {
  const scaledPnl = t.returnPct !== null ? positionSize * t.returnPct : null;
  const returnColor =
    t.returnPct !== null && t.returnPct > 0
      ? "text-green-600 dark:text-green-400"
      : t.returnPct !== null && t.returnPct < 0
        ? "text-red-600 dark:text-red-400"
        : "text-gray-400 dark:text-zinc-500";

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50">
      <td className="max-w-[min(100%,16rem)] px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <Link
            href={`/ticker/${t.symbol}`}
            className="shrink-0 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {t.symbol}
          </Link>
          {t.name ? (
            <>
              <span className="shrink-0 text-xs text-gray-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <span
                className="min-w-0 truncate text-xs text-gray-400 dark:text-zinc-500"
                title={t.name}
              >
                {t.name}
              </span>
            </>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-gray-700 dark:text-zinc-200">
        {t.aiScore}
      </td>
      <td className="px-3 py-2.5 text-right text-gray-600 dark:text-zinc-400">
        {formatPrice(t.entryPrice)}
      </td>
      <td className="px-3 py-2.5 text-right text-gray-600 dark:text-zinc-400">
        {t.exitPrice !== null ? formatPrice(t.exitPrice) : "--"}
      </td>
      <td className={`px-3 py-2.5 text-right font-medium ${returnColor}`}>
        {t.returnPct !== null ? formatPct(t.returnPct) : "--"}
      </td>
      <td className={`px-3 py-2.5 text-right font-medium ${returnColor}`}>
        {scaledPnl !== null ? formatUsd(scaledPnl) : "--"}
      </td>
      <td className="px-3 py-2.5 text-center text-gray-500 dark:text-zinc-400">
        {t.holdDays ?? "--"}
      </td>
      {showExitDate && (
        <td className="px-3 py-2.5 text-right text-gray-500 dark:text-zinc-400">
          {t.closingAt ?? "--"}
        </td>
      )}
      {showDetectedColumn && (
        <td className="px-3 py-2.5 text-right text-gray-500 dark:text-zinc-400">
          {t.detectedAt}
        </td>
      )}
    </tr>
  );
}
