import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ValidatedTickerData } from "@/hooks/use-scans";

function pctChange(from: number, to: number): string {
  const pct = ((to - from) / from) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function TradeSetupCard({ ticker }: { ticker: ValidatedTickerData }) {
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

  // Only render if trade setup data exists
  if (entryLo == null || entryHi == null || stopLoss == null || target1 == null || target2 == null) {
    return null;
  }

  const entryMid = (entryLo + entryHi) / 2;

  const confidenceVariant =
    confidence === "High" ? "success" : confidence === "Medium" ? "warning" : "danger";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Trade setup</h3>
          {confidence && <Badge variant={confidenceVariant}>{confidence} Confidence</Badge>}
          {riskReward && <Badge variant="purple">{riskReward} R:R</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Entry Range</p>
            <p className="font-semibold text-gray-900 dark:text-zinc-100">
              ${entryLo.toFixed(2)} &ndash; ${entryHi.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Stop Loss</p>
            <p className="font-semibold text-red-600 dark:text-red-400">
              ${stopLoss.toFixed(2)}{" "}
              <span className="text-xs font-normal">
                ({pctChange(entryMid, stopLoss)})
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Target 1</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              ${target1.toFixed(2)}{" "}
              <span className="text-xs font-normal">
                ({pctChange(entryMid, target1)})
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Target 2</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              ${target2.toFixed(2)}{" "}
              <span className="text-xs font-normal">
                ({pctChange(entryMid, target2)})
              </span>
            </p>
          </div>
          {timeframe && (
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Timeframe</p>
              <p className="font-semibold text-gray-900 dark:text-zinc-100">{timeframe}</p>
            </div>
          )}
          {price != null && (
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Current Price</p>
              <p className="font-semibold text-gray-900 dark:text-zinc-100">${price.toFixed(2)}</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500">
          AI-generated setup based on signal data and fundamentals. Not financial advice. Verify levels against a live chart.
        </p>
      </CardContent>
    </Card>
  );
}
