"use client";

import { useState, useEffect } from "react";
import { useAddPosition } from "@/hooks/use-portfolio";

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
      // addPosition.isError / addPosition.error surface the failure in the UI
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile bottom-sheet feel */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 sm:hidden" />

        <h2 className="mb-4 text-lg font-bold">Add position — {symbol}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Entry Price
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base sm:py-2 sm:text-sm"
              required
              autoFocus
            />
          </div>

          {addPosition.isError && (
            <p className="text-sm text-red-600">
              Failed to add position. Please try again.
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 sm:flex-none sm:py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addPosition.isPending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:flex-none sm:py-2"
            >
              {addPosition.isPending ? "Adding..." : "Add Position"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
