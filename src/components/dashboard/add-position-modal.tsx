"use client";

import { useState } from "react";
import { useAddPosition } from "@/hooks/use-portfolio";

export function AddPositionModal({
  symbol,
  price,
  onClose,
}: {
  symbol: string;
  price: number;
  onClose: () => void;
}) {
  const [entryPrice, setEntryPrice] = useState(price.toString());
  const addPosition = useAddPosition();

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
      <div className="w-full max-w-sm rounded-t-lg bg-white p-6 shadow-xl sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">Add position — {symbol}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Entry Price
            </label>
            <input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
              autoFocus
            />
          </div>

          {addPosition.isError && (
            <p className="text-sm text-red-600">
              Failed to add position. Please try again.
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addPosition.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {addPosition.isPending ? "Adding..." : "Add Position"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
