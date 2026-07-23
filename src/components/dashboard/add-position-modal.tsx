"use client";

import { useState, useEffect } from "react";
import { useAddPosition } from "@/hooks/use-portfolio";
import { inputCls } from "@/lib/input-cls";

export function AddPositionModal({
  symbol,
  onClose,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const [entryPrice, setEntryPrice] = useState("");
  const addPosition = useAddPosition();

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addPosition.mutateAsync({
        symbol,
        entryPrice: parseFloat(entryPrice),
      });
      onClose();
    } catch {
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl border border-gray-200 bg-white px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl dark:border-zinc-600/40 dark:bg-zinc-900/95 dark:shadow-[0_0_48px_-12px_rgba(0,0,0,0.45)] dark:ring-1 dark:ring-white/5 sm:rounded-xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 dark:bg-zinc-600 sm:hidden" />

        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-zinc-100">
          Add position — {symbol}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Entry Price
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className={`w-full px-3 py-3 placeholder-gray-400 shadow-inner sm:py-2 dark:placeholder-zinc-500 dark:bg-zinc-950/50 ${inputCls}`}
              required
              autoFocus
            />
          </div>

          {addPosition.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to add position. Please try again.
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 sm:flex-none sm:py-2 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addPosition.isPending}
              className="flex-1 rounded-lg bg-linear-to-br from-sky-500 to-blue-600 px-4 py-3 text-sm font-medium text-white shadow-md hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 sm:flex-none sm:py-2 dark:shadow-sky-950/30"
            >
              {addPosition.isPending ? "Adding..." : "Add Position"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
