"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ValidatedTickerData } from "@/hooks/use-scans";

const stageColors: Record<string, "success" | "warning" | "info" | "danger"> = {
  CONFIRMED: "success",
  FORMING: "warning",
  EARLY: "info",
  FILTERED: "danger",
};

const recColors: Record<string, "success" | "warning" | "info" | "danger"> = {
  "Strong Buy": "success",
  Buy: "success",
  Watch: "warning",
  Avoid: "danger",
};

export function SignalCard({
  ticker,
  onTrack,
}: {
  ticker: ValidatedTickerData;
  onTrack?: (symbol: string, price: number) => void;
}) {
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/ticker/${ticker.symbol}`}
              className="text-lg font-bold text-gray-900 hover:text-blue-600"
            >
              {ticker.symbol}
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={stageColors[ticker.stage] || "default"}>
                {ticker.stage}
              </Badge>
              {ticker.recommendation && (
                <Badge variant={recColors[ticker.recommendation] || "default"}>
                  {ticker.recommendation}
                </Badge>
              )}
            </div>
          </div>

          <div className="text-right">
            {ticker.price && (
              <p className="text-lg font-semibold">
                ${ticker.price.toFixed(2)}
              </p>
            )}
            <p className="text-sm text-gray-500">
              Score: {ticker.aiScore}/100
            </p>
          </div>
        </div>

        {ticker.catalyst && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">Thesis:</span> {ticker.catalyst}
          </p>
        )}
        {ticker.risks && (
          <p className="text-sm text-amber-700">
            <span className="font-medium">Risks:</span> {ticker.risks}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {ticker.sources?.length > 0 && (
            <span>
              <span className="font-medium">Sources:</span>{" "}
              {ticker.sources.map((s) => s.replace("_", " ")).join(", ")}
            </span>
          )}
          {ticker.shortFloat != null && (
            <span>
              <span className="font-medium">Short float:</span>{" "}
              {(ticker.shortFloat * 100).toFixed(1)}%
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
          <span>
            {ticker.signalCount} signals
          </span>
          {onTrack && ticker.price && (
            <button
              onClick={() => onTrack(ticker.symbol, ticker.price!)}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              Add position
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
