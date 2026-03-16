"use client";

import { useState } from "react";
import {
  usePortfolio,
  useAddPosition,
  useUpdatePosition,
  useDeletePosition,
  type PositionData,
} from "@/hooks/use-portfolio";
import { PositionCard } from "@/components/portfolio/position-card";
import { Spinner } from "@/components/ui/spinner";

export default function PortfolioPage() {
  const { data, isLoading, isError, refetch, isFetching } = usePortfolio();
  const updatePosition = useUpdatePosition();
  const deletePosition = useDeletePosition();
  const addPosition = useAddPosition();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [closePrice, setClosePrice] = useState("");
  const [deletingPosition, setDeletingPosition] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [editEntryPrice, setEditEntryPrice] = useState("");

  const positions = data?.positions || [];
  const openPositions: (PositionData & { daysOpen: number })[] = positions
    .filter((p: PositionData) => p.status === "OPEN")
    .map((p: PositionData) => ({
      ...p,
      daysOpen: Math.floor(
        (Date.now() - new Date(p.openedAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen);
  const closedPositions = positions.filter((p) => p.status === "CLOSED");

  const avgOpenGain =
    openPositions.length > 0
      ? openPositions.reduce((sum, p) => sum + (p.gainPct || 0), 0) /
        openPositions.length
      : 0;

  const avgGainByBucket = (minDays: number, maxDays: number) => {
    const bucket = openPositions.filter(
      (p) => p.daysOpen >= minDays && p.daysOpen <= maxDays
    );
    if (bucket.length === 0) return null;
    return {
      avg:
        bucket.reduce((sum, p) => sum + (p.gainPct || 0), 0) / bucket.length,
      count: bucket.length,
    };
  };

  const dayBuckets = [
    { label: "1d", ...({ data: avgGainByBucket(0, 1) } as const) },
    { label: "3d", ...({ data: avgGainByBucket(2, 3) } as const) },
    { label: "7d", ...({ data: avgGainByBucket(4, 7) } as const) },
    { label: "30d", ...({ data: avgGainByBucket(8, 30) } as const) },
  ];

  const avgClosedGain =
    closedPositions.length > 0
      ? closedPositions.reduce((sum, p) => sum + (p.gainPct || 0), 0) /
        closedPositions.length
      : 0;

  const avgAllGain =
    positions.length > 0
      ? positions.reduce((sum, p) => sum + (p.gainPct || 0), 0) /
        positions.length
      : 0;

  const closingPos = closingPosition
    ? positions.find((p) => p.id === closingPosition)
    : null;

  const handleClose = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    setClosePrice(pos?.currentPrice?.toFixed(2) ?? "");
    setClosingPosition(id);
  };

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingPosition || !closePrice) return;
    try {
      await updatePosition.mutateAsync({
        id: closingPosition,
        status: "CLOSED",
        closePrice: parseFloat(closePrice),
      });
      setClosingPosition(null);
      setClosePrice("");
    } catch {
      // updatePosition.isError surfaces the failure in the UI
    }
  };

  const handleDelete = (id: string) => {
    setDeletingPosition(id);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPosition) return;
    try {
      await deletePosition.mutateAsync(deletingPosition);
      setDeletingPosition(null);
    } catch {
      // deletePosition.isError surfaces the failure in the UI
    }
  };

  const handleEdit = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    setEditEntryPrice(pos.entryPrice.toString());
    setEditingPosition(id);
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPosition || !editEntryPrice) return;
    try {
      await updatePosition.mutateAsync({
        id: editingPosition,
        entryPrice: parseFloat(editEntryPrice),
      });
      setEditingPosition(null);
    } catch {
      // updatePosition.isError surfaces the failure in the UI
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol || !newPrice) return;
    try {
      await addPosition.mutateAsync({
        symbol: newSymbol.toUpperCase(),
        entryPrice: parseFloat(newPrice),
      });
      setNewSymbol("");
      setNewPrice("");
      setShowAddForm(false);
    } catch {
      // addPosition.isError surfaces the failure in the UI
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Portfolio</h1>
          {positions.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {positions.length} positions &middot; Overall avg gain:{" "}
              <span
                className={
                  avgAllGain >= 0 ? "text-green-600" : "text-red-600"
                }
              >
                {avgAllGain >= 0 ? "+" : ""}
                {avgAllGain.toFixed(2)}%
              </span>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Position
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Symbol
            </label>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="AAPL"
              className="w-28 rounded border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Entry Price
            </label>
            <input
              type="number"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="150.00"
              className="w-32 rounded border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={addPosition.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          {addPosition.isError && (
            <p className="w-full text-sm text-red-600">Failed to add position. Please try again.</p>
          )}
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center">
          <p className="text-red-600">Failed to load portfolio. Please refresh and try again.</p>
        </div>
      ) : openPositions.length === 0 && closedPositions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">
            No positions yet. Track a signal from the dashboard or add one
            manually.
          </p>
        </div>
      ) : (
        <>
          {openPositions.length > 0 && (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  Open Positions
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    &middot; Avg gain:{" "}
                    <span
                      className={
                        avgOpenGain >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {avgOpenGain >= 0 ? "+" : ""}
                      {avgOpenGain.toFixed(2)}%
                    </span>
                  </span>
                </h2>
                <div className="flex items-center gap-3">
                  {dayBuckets.map((b) => (
                    <span key={b.label} className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">{b.label}:</span>{" "}
                      {b.data ? (
                        <span
                          className={
                            b.data.avg >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {b.data.avg >= 0 ? "+" : ""}
                          {b.data.avg.toFixed(1)}%
                          <span className="text-gray-400"> ({b.data.count})</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  title="Refresh stock prices"
                >
                  {isFetching ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2v6h-6" />
                      <path d="M3 12a9 9 0 0115.36-6.36L21 8" />
                      <path d="M3 22v-6h6" />
                      <path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {openPositions.map((p) => (
                  <PositionCard
                    key={p.id}
                    position={p}
                    onClose={handleClose}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {closedPositions.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-500">
                Closed Positions
                <span className="ml-2 text-sm font-normal">
                  &middot; Avg gain:{" "}
                  <span
                    className={
                      avgClosedGain >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    {avgClosedGain >= 0 ? "+" : ""}
                    {avgClosedGain.toFixed(2)}%
                  </span>
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {closedPositions.map((p) => (
                  <PositionCard
                    key={p.id}
                    position={p}
                    onClose={handleClose}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {closingPosition && closingPos && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <form
            onSubmit={handleConfirmClose}
            className="w-full max-w-sm rounded-t-lg bg-white p-6 shadow-xl sm:rounded-lg"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              Close {closingPos.symbol}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Entry price: ${closingPos.entryPrice.toFixed(2)}
              {closingPos.currentPrice != null && (
                <> &middot; Current: ${closingPos.currentPrice.toFixed(2)}</>
              )}
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Exit Price
              </label>
              <input
                type="number"
                step="0.01"
                value={closePrice}
                onChange={(e) => setClosePrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                autoFocus
                required
              />
            </div>
            {updatePosition.isError && (
              <p className="mt-3 text-sm text-red-600">Failed to close position. Please try again.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setClosingPosition(null);
                  setClosePrice("");
                }}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatePosition.isPending}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Close Position
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingPosition && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full max-w-sm rounded-t-lg bg-white p-6 shadow-xl sm:rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Position
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete this position? This action cannot be undone.
            </p>
            {deletePosition.isError && (
              <p className="mt-3 text-sm text-red-600">Failed to delete position. Please try again.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingPosition(null)}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletePosition.isPending}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPosition && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <form
            onSubmit={handleConfirmEdit}
            className="w-full max-w-sm rounded-t-lg bg-white p-6 shadow-xl sm:rounded-lg"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              Edit Position
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Entry Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editEntryPrice}
                  onChange={(e) => setEditEntryPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  autoFocus
                  required
                />
              </div>
            </div>
            {updatePosition.isError && (
              <p className="mt-3 text-sm text-red-600">Failed to update position. Please try again.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPosition(null)}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatePosition.isPending}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
