"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useIbkrPaperTrades, type IbkrTrade, type IbkrAccount, type IbkrPortfolioHistory } from "@/hooks/use-ibkr-paper-trading";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { KpiTile } from "@/components/ui/kpi-tile";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";

const EQUITY_CHART_W = 520;
const EQUITY_CHART_H = 100;
const EQUITY_PAD = { top: 12, right: 20, bottom: 20, left: 44 };
const EQUITY_PLOT_W = EQUITY_CHART_W - EQUITY_PAD.left - EQUITY_PAD.right;
const EQUITY_PLOT_H = EQUITY_CHART_H - EQUITY_PAD.top - EQUITY_PAD.bottom;

function fmtDollarAxis(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `$${v.toFixed(0)}`;
}

function niceStep(range: number, maxTicks: number): number {
  const rough = range / maxTicks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export default function PaperTradingPage() {
  const ibkr = useIbkrPaperTrades();
  const ibkrHasData = ibkr.data && ibkr.data.trades.length > 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Paper Trading"
        subtitle="Live Alpaca paper account — real order fills, real slippage. SignalScope executes every recommended trade setup automatically."
      />
      <IbkrPanel ibkr={ibkr} ibkrHasData={!!ibkrHasData} />
    </div>
  );
}

function IbkrPanel({
  ibkr,
  ibkrHasData,
}: {
  ibkr: ReturnType<typeof useIbkrPaperTrades>;
  ibkrHasData: boolean;
}) {
  const { data, isLoading, error } = ibkr;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-center text-gray-500 dark:text-zinc-400">
        Failed to load Alpaca paper trading data.
      </p>
    );
  }

  if (!ibkrHasData) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 p-10 text-center">
        <p className="text-sm font-medium text-gray-600 dark:text-zinc-300">No trades yet</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
          Orders are placed automatically after each harvest cycle. Check back after the next scan.
        </p>
      </div>
    );
  }

  const { summary, trades, benchmark, account, portfolioHistory } = data;
  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live fills — SignalScope-owned Alpaca paper account · $1,000/leg · auto-executed
      </div>

      {account && <AlpacaAccountBar account={account} />}
      {portfolioHistory && <AlpacaEquityCurve history={portfolioHistory} />}

      <section
        aria-label="Alpaca paper trading summary"
        className="rounded-2xl border border-gray-200/90 bg-linear-to-b from-gray-50/95 to-white p-2 shadow-sm sm:p-3 dark:border-zinc-800 dark:from-zinc-900/80 dark:to-[#12181f]"
      >
        <div className="grid grid-cols-2 gap-2 *:min-w-0 [&>:last-child]:col-span-2 sm:[&>:last-child]:col-span-1 sm:grid-cols-3 sm:gap-3 md:grid-cols-5 lg:gap-2">
          <KpiTile
            label="Total trades"
            value={String(summary.totalTrades)}
            sub={`${summary.openTrades} open · ${summary.closedTrades} closed`}
          />
          <KpiTile
            label="Win rate"
            value={summary.closedTrades > 0 ? `${(summary.winRate * 100).toFixed(0)}%` : "--"}
            sub="closed only"
          />
          <KpiTile
            label="Avg return"
            value={summary.tradesWithMark > 0 ? `${summary.avgReturn >= 0 ? "+" : ""}${(summary.avgReturn * 100).toFixed(1)}%` : "--"}
            valueColor={
              summary.tradesWithMark === 0 ? undefined : summary.avgReturn > 0 ? "green" : summary.avgReturn < 0 ? "red" : undefined
            }
            sub={`n=${summary.tradesWithMark}`}
            subHint="Capital-weighted: total P&L ÷ total deployed capital"
          />
          <KpiTile
            label="S&P 500"
            value={
              (benchmark.matchedReturnPct ?? benchmark.returnPct) !== null
                ? `${(benchmark.matchedReturnPct ?? benchmark.returnPct)! >= 0 ? "+" : ""}${((benchmark.matchedReturnPct ?? benchmark.returnPct)! * 100).toFixed(1)}%`
                : "--"
            }
            valueColor={
              (benchmark.matchedReturnPct ?? benchmark.returnPct) === null
                ? undefined
                : (benchmark.matchedReturnPct ?? benchmark.returnPct)! > 0
                  ? "green"
                  : (benchmark.matchedReturnPct ?? benchmark.returnPct)! < 0
                    ? "red"
                    : undefined
            }
            sub={benchmark.matchedReturnPct !== null ? "matched capital + hold" : "30d"}
            subHint="What SPY would have returned with the same dollars deployed for the same hold period as each trade"
          />
          <KpiTile
            label="Total P&L"
            value={summary.tradesWithMark > 0 ? `${summary.totalPnl >= 0 ? "+" : "-"}$${Math.abs(summary.totalPnl).toFixed(2)}` : "--"}
            valueColor={summary.tradesWithMark === 0 ? undefined : summary.totalPnl > 0 ? "green" : summary.totalPnl < 0 ? "red" : undefined}
            sub="open + closed"
            subHint="Sum of unrealized (open) and realized (closed) P&L from actual Alpaca fills"
          />
        </div>
      </section>

      <IbkrTradesTable title="Open Positions" trades={openTrades} emptyMessage="No open positions." />
      <IbkrTradesTable title="Closed Positions" trades={closedTrades} emptyMessage="No closed positions yet." showClosedAt />

      <p className="text-xs text-gray-400 dark:text-zinc-600">
        Orders placed on a SignalScope-owned Alpaca paper account. Not investment advice. Results shown for transparency only.
      </p>
    </div>
  );
}

function AlpacaEquityCurve({ history }: { history: IbkrPortfolioHistory }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const pts = history.points.filter((p) => p.equity != null && p.equity > 0);
  if (pts.length < 2) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800/90 dark:bg-[#12181f]">
        <p className="text-center text-sm text-gray-400 dark:text-zinc-500">Not enough history yet</p>
      </div>
    );
  }

  const values = pts.map((p) => p.equity);
  const baseValue = history.baseValue > 0 ? history.baseValue : values[0];
  const latestEquity = values[values.length - 1];
  const totalReturn = (latestEquity - baseValue) / baseValue;
  const isPositive = totalReturn >= 0;

  const lineColor = isPositive
    ? isDark ? "#34d399" : "#059669"
    : isDark ? "#f87171" : "#dc2626";

  const allVals = [baseValue, ...values];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const minRange = baseValue * 0.05;
  const range = Math.max(maxV - minV, minRange) || 100;
  const padV = range * 0.15;
  const yMin = minV - padV;
  const yMax = maxV + padV;
  const n = pts.length;

  function xPos(i: number) {
    return EQUITY_PAD.left + (i / (n - 1)) * EQUITY_PLOT_W;
  }
  function yPos(v: number) {
    return EQUITY_PAD.top + EQUITY_PLOT_H - ((v - yMin) / (yMax - yMin)) * EQUITY_PLOT_H;
  }

  function buildCurve(vals: number[]): string {
    const points = vals.map((v, i) => ({ x: xPos(i), y: yPos(v) }));
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const cp1x = points[i].x + dx * 0.4;
      const cp2x = points[i + 1].x - dx * 0.4;
      d += ` C ${cp1x},${points[i].y} ${cp2x},${points[i + 1].y} ${points[i + 1].x},${points[i + 1].y}`;
    }
    return d;
  }

  const curve = buildCurve(values);
  const areaPath = `${curve} L ${xPos(n - 1)},${EQUITY_PAD.top + EQUITY_PLOT_H} L ${xPos(0)},${EQUITY_PAD.top + EQUITY_PLOT_H} Z`;

  const yTicks: number[] = [];
  const step = niceStep(yMax - yMin, 4);
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) yTicks.push(v);

  const xLabelCount = Math.min(5, n);
  const xIndices = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i / (xLabelCount - 1)) * (n - 1)),
  );

  const gridColor = isDark ? "#3f3f46" : "#f3f4f6";
  const labelColor = isDark ? "#a1a1aa" : "#9ca3af";
  const xLabelColor = isDark ? "#a1a1aa" : "#6b7280";

  function formatXLabel(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800/90 dark:bg-[#12181f]">
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Account Equity</h3>
          <span className={`text-sm font-semibold tabular-nums ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {totalReturn >= 0 ? "+" : ""}{(totalReturn * 100).toFixed(2)}%
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Daily portfolio value from Alpaca · last 30 days
        </p>
      </div>

      <svg
        viewBox={`0 0 ${EQUITY_CHART_W} ${EQUITY_CHART_H}`}
        className="w-full"
        style={{ overflow: "visible" }}
        role="img"
        aria-label="Account equity chart"
      >
        <defs>
          <linearGradient id="equity-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={isDark ? "0.25" : "0.15"} />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => (
          <line key={v} x1={EQUITY_PAD.left} x2={EQUITY_PAD.left + EQUITY_PLOT_W} y1={yPos(v)} y2={yPos(v)} stroke={gridColor} strokeWidth={0.5} />
        ))}
        {yTicks.map((v) => (
          <text key={v} x={EQUITY_PAD.left - 8} y={yPos(v)} textAnchor="end" dominantBaseline="central" fill={labelColor} fontSize="5">
            {fmtDollarAxis(v)}
          </text>
        ))}
        {xIndices.map((idx) => (
          <text key={idx} x={xPos(idx)} y={EQUITY_CHART_H - 5} textAnchor="middle" fill={xLabelColor} fontSize="5.5" fontWeight="500">
            {formatXLabel(pts[idx].timestamp)}
          </text>
        ))}

        <path d={areaPath} fill="url(#equity-area-fill)" />
        <path d={curve} fill="none" stroke={lineColor} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xPos(n - 1)} cy={yPos(values[n - 1])} r={2} fill={lineColor} stroke={isDark ? "#12181f" : "white"} strokeWidth="0.75" />
      </svg>
    </div>
  );
}

function AlpacaAccountBar({ account }: { account: IbkrAccount }) {
  const dayChange = account.equity - account.lastEquity;
  const dayChangePct = account.lastEquity > 0 ? dayChange / account.lastEquity : 0;
  const dayColor =
    dayChange > 0
      ? "text-green-600 dark:text-green-400"
      : dayChange < 0
        ? "text-red-600 dark:text-red-400"
        : "text-gray-700 dark:text-zinc-200";

  return (
    <section
      aria-label="Alpaca account overview"
      className="rounded-xl border border-gray-200/90 bg-white px-3 py-2.5 shadow-sm sm:px-4 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
          Account · {account.currency}
        </p>
        {account.tradingBlocked && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
            Trading blocked
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3 md:flex md:flex-wrap md:gap-x-6 md:gap-y-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-gray-500 dark:text-zinc-400">Portfolio value</span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
            ${account.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-gray-500 dark:text-zinc-400">Day change</span>
          <span className={`font-semibold tabular-nums ${dayColor}`}>
            {dayChange >= 0 ? "+" : ""}${Math.abs(dayChange).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="ml-1 text-[10px] font-normal">
              ({dayChangePct >= 0 ? "+" : ""}{(dayChangePct * 100).toFixed(2)}%)
            </span>
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-gray-500 dark:text-zinc-400">Invested</span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
            ${account.longMarketValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-gray-500 dark:text-zinc-400">Cash</span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
            ${account.cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-gray-500 dark:text-zinc-400">Buying power</span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
            ${account.buyingPower.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-gray-500 dark:text-zinc-400">Day trades</span>
          <span className={`font-semibold tabular-nums ${account.dayTradeCount >= 3 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-zinc-100"}`}>
            {account.dayTradeCount} / 3
          </span>
        </div>
      </div>
    </section>
  );
}

function IbkrTradesTable({
  title,
  trades,
  emptyMessage,
  showClosedAt = false,
}: {
  title: string;
  trades: IbkrTrade[];
  emptyMessage: string;
  showClosedAt?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="px-3! py-3! sm:px-4! md:px-6! md:py-4!">
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
      </CardHeader>
      <CardContent className="p-0">
        <div className="hidden max-h-[400px] overflow-x-auto overflow-y-auto md:block">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-900">
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-3 py-3 font-medium text-right">AI Score</th>
                <th className="px-3 py-3 font-medium text-right">Qty</th>
                <th className="px-3 py-3 font-medium text-right">Entry</th>
                <th className="px-3 py-3 font-medium text-right">Price</th>
                <th className="px-3 py-3 font-medium text-right">Return</th>
                <th className="px-3 py-3 font-medium text-right">P&L</th>
                <th className="px-3 py-3 font-medium text-right">Hold</th>
                {showClosedAt && <th className="px-3 py-3 font-medium text-right">Closed</th>}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && (
                <tr>
                  <td colSpan={8 + (showClosedAt ? 1 : 0)} className="py-8 text-center text-gray-400 dark:text-zinc-500">
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {trades.map((t) => {
                const returnColor =
                  t.returnPct !== null && t.returnPct > 0
                    ? "text-green-600 dark:text-green-400"
                    : t.returnPct !== null && t.returnPct < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-400 dark:text-zinc-500";
                const pnlVal = t.pnl;
                return (
                  <tr key={`${t.symbol}-${t.openedAt}`} className="border-b border-gray-50 hover:bg-gray-50/50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/ticker/${t.symbol}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                        {t.symbol}
                      </Link>
                      {t.name && <span className="ml-1.5 text-xs text-gray-400 dark:text-zinc-500 truncate">{t.name}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-zinc-200">{t.aiScore ?? "--"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-zinc-400">{t.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-zinc-400">${t.entryPrice.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-zinc-400">
                      {t.exitPrice !== null ? `$${t.exitPrice.toFixed(2)}` : "--"}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${returnColor}`}>
                      {t.returnPct !== null ? `${t.returnPct >= 0 ? "+" : ""}${(t.returnPct * 100).toFixed(1)}%` : "--"}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${returnColor}`}>
                      {pnlVal !== null ? `${pnlVal >= 0 ? "+" : "-"}$${Math.abs(pnlVal).toFixed(2)}` : "--"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500 dark:text-zinc-400">{t.holdDays}d</td>
                    {showClosedAt && (
                      <td className="px-3 py-2.5 text-right text-gray-500 dark:text-zinc-400">{t.closedAt ?? "--"}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile list */}
        <div className="space-y-3 px-3 pb-4 md:hidden">
          {trades.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{emptyMessage}</p>
          )}
          {trades.map((t) => {
            const returnColor =
              t.returnPct !== null && t.returnPct > 0
                ? "text-green-600 dark:text-green-400"
                : t.returnPct !== null && t.returnPct < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-zinc-400";
            const pnlVal = t.pnl;
            return (
              <div key={`${t.symbol}-${t.openedAt}`} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/ticker/${t.symbol}`} className="text-base font-semibold text-blue-600 hover:underline dark:text-blue-400">
                      {t.symbol}
                    </Link>
                    {t.name && <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t.name}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${returnColor}`}>
                      {t.returnPct !== null ? `${t.returnPct >= 0 ? "+" : ""}${(t.returnPct * 100).toFixed(1)}%` : "—"}
                    </p>
                    <p className={`text-xs ${returnColor}`}>
                      {pnlVal !== null ? `${pnlVal >= 0 ? "+" : "-"}$${Math.abs(pnlVal).toFixed(2)}` : "—"}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-gray-500 dark:text-zinc-500">Entry</dt>
                  <dd className="text-right font-medium tabular-nums">${t.entryPrice.toFixed(2)}</dd>
                  <dt className="text-gray-500 dark:text-zinc-500">Qty</dt>
                  <dd className="text-right font-medium tabular-nums">{t.quantity} sh</dd>
                  <dt className="text-gray-500 dark:text-zinc-500">Hold</dt>
                  <dd className="text-right font-medium">{t.holdDays}d</dd>
                  {showClosedAt && t.closedAt && (
                    <>
                      <dt className="text-gray-500 dark:text-zinc-500">Closed</dt>
                      <dd className="text-right">{t.closedAt}</dd>
                    </>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
