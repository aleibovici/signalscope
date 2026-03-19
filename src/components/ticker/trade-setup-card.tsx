import { Badge } from "@/components/ui/badge";
import type { ValidatedTickerData } from "@/hooks/use-scans";

function pctChange(from: number, to: number): string {
  const pct = ((to - from) / from) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TradeSetupCard({
  ticker,
  className = "",
}: {
  ticker: ValidatedTickerData;
  /** e.g. rounded-xl border border-slate-200 dark:border-[#1e262f] */
  className?: string;
}) {
  const {
    tradeSetupEntryLo: entryLo,
    tradeSetupEntryHi: entryHi,
    tradeSetupStopLoss: stopLoss,
    tradeSetupTarget1: target1,
    tradeSetupTarget2: target2,
    tradeSetupTimeframe: timeframe,
    tradeSetupRiskReward: riskReward,
    tradeSetupConfidence: confidence,
    price,
  } = ticker;

  if (entryLo == null || entryHi == null || stopLoss == null || target1 == null || target2 == null) {
    return null;
  }

  const entryMid = (entryLo + entryHi) / 2;

  const confidenceVariant =
    confidence === "High" ? "success" : confidence === "Medium" ? "warning" : "danger";

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-6 dark:border-[#1e262f] dark:bg-[#12181f] ${className}`}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-zinc-100">
          <TargetIcon className="h-5 w-5 shrink-0 text-emerald-500" />
          Trade setup
        </h3>
        <div className="flex flex-wrap gap-2">
          {confidence ? (
            <Badge variant={confidenceVariant} className="rounded px-2 py-0.5 text-[10px] font-bold uppercase">
              {confidence} confidence
            </Badge>
          ) : null}
          {riskReward ? (
            <span className="rounded bg-blue-600/10 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              R:R {riskReward}
            </span>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Entry range
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ${entryLo.toFixed(2)} – ${entryHi.toFixed(2)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Stop loss</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ${stopLoss.toFixed(2)}{" "}
            <span className="text-xs font-normal text-slate-500">({pctChange(entryMid, stopLoss)})</span>
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Target 1</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ${target1.toFixed(2)}{" "}
            <span className="text-xs font-normal text-slate-500">({pctChange(entryMid, target1)})</span>
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Timeframe
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{timeframe ?? "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Target 2</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ${target2.toFixed(2)}{" "}
            <span className="text-xs font-normal text-slate-500">({pctChange(entryMid, target2)})</span>
          </p>
        </div>
        {price != null && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Current price
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">${price.toFixed(2)}</p>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500">
        AI-generated setup. Not financial advice. Verify on a chart.
      </p>
    </div>
  );
}
