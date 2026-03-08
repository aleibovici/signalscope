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
  position: PositionData;
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
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-lg font-bold text-gray-900">
              {position.symbol}
            </span>
            <Badge
              variant={isOpen ? "success" : "default"}
              className="ml-2"
            >
              {position.status}
            </Badge>
          </div>
          <div className="text-right">
            {gainPct != null && (
              <p
                className={`text-lg font-bold ${
                  isPositive
                    ? "text-green-600"
                    : isNegative
                      ? "text-red-600"
                      : "text-gray-600"
                }`}
              >
                {isPositive ? "+" : ""}
                {gainPct.toFixed(2)}%
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div>
            <span className="text-gray-400">Entry</span>
            <p className="font-medium">${position.entryPrice.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-gray-400">Current</span>
            <p className="font-medium">
              {position.currentPrice != null
                ? `$${position.currentPrice.toFixed(2)}`
                : "N/A"}
            </p>
          </div>
          {position.shares && (
            <div>
              <span className="text-gray-400">Shares</span>
              <p className="font-medium">{position.shares}</p>
            </div>
          )}
          <div>
            <span className="text-gray-400">Opened</span>
            <p className="font-medium">
              {new Date(position.openedAt).toLocaleDateString()}
            </p>
          </div>
          {!isOpen && position.closedAt && (
            <div>
              <span className="text-gray-400">Closed</span>
              <p className="font-medium">
                {new Date(position.closedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {position.notes && (
          <p className="text-xs text-gray-500">{position.notes}</p>
        )}

        {isOpen && (
          <div className="flex gap-2">
            <button
              onClick={() => onClose(position.id)}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Close Position
            </button>
            <button
              onClick={() => onEdit(position.id)}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(position.id)}
              className="rounded px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
