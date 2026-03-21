"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PositionData } from "@/hooks/use-portfolio";

export function PositionCard({
  position,
  onClose,
  onEdit,
  onDelete,
}: {
  position: PositionData & { daysOpen?: number };
  onClose: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOpen = position.status === "OPEN";
  const gainPct = position.gainPct;
  const isPositive = gainPct != null && gainPct > 0;
  const isNegative = gainPct != null && gainPct < 0;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="px-4 py-3">
        {/* Row 1: symbol + badge + gain + days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 dark:text-zinc-100">{position.symbol}</span>
            <Badge variant={isOpen ? "success" : "default"} className="text-xs">
              {position.status}
            </Badge>
            {isOpen && position.daysOpen != null && (
              <span className="text-xs text-gray-400">{position.daysOpen}d</span>
            )}
          </div>
          {gainPct != null && (
            <span
              className={`text-sm font-bold ${
                isPositive ? "text-green-600 dark:text-green-400" : isNegative ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-zinc-300"
              }`}
            >
              {isPositive ? "+" : ""}{gainPct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Row 2: prices inline */}
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-zinc-400">
          <span>Entry <span className="font-medium text-gray-700 dark:text-zinc-200">${position.entryPrice.toFixed(2)}</span></span>
          <span>Current <span className="font-medium text-gray-700 dark:text-zinc-200">
            {position.currentPrice != null ? `$${position.currentPrice.toFixed(2)}` : "N/A"}
          </span></span>
          {position.shares && (
            <span>Shares <span className="font-medium text-gray-700 dark:text-zinc-200">{position.shares}</span></span>
          )}
          <span>Opened <span className="font-medium text-gray-700 dark:text-zinc-200">
            {new Date(position.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span></span>
          {!isOpen && position.closedAt && (
            <span>Closed <span className="font-medium text-gray-700 dark:text-zinc-200">
              {new Date(position.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span></span>
          )}
        </div>

        {position.notes && (
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{position.notes}</p>
        )}

        {isOpen && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onClose(position.id)}
              className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Close
            </button>
            <button
              onClick={() => onEdit(position.id)}
              className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(position.id)}
              className="rounded px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              Delete
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
