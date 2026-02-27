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
  const [shares, setShares] = useState("");
  const [notes, setNotes] = useState("");
  const addPosition = useAddPosition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addPosition.mutateAsync({
      symbol,
      entryPrice: parseFloat(entryPrice),
      shares: shares ? parseFloat(shares) : undefined,
      notes: notes || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-lg bg-white p-6 shadow-xl sm:rounded-lg">
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
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Shares (optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

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
