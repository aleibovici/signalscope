"use client";

import { useState } from "react";
import {
  usePortfolio,
  useAddPosition,
  useUpdatePosition,
  useDeletePosition,
} from "@/hooks/use-portfolio";
import { PositionCard } from "@/components/portfolio/position-card";
import { Spinner } from "@/components/ui/spinner";

export default function PortfolioPage() {
  const { data, isLoading } = usePortfolio();
  const updatePosition = useUpdatePosition();
  const deletePosition = useDeletePosition();
  const addPosition = useAddPosition();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [closePrice, setClosePrice] = useState("");

  const positions = data?.positions || [];
  const openPositions = positions.filter((p) => p.status === "OPEN");
  const closedPositions = positions.filter((p) => p.status === "CLOSED");

  const avgOpenGain =
    openPositions.length > 0
      ? openPositions.reduce((sum, p) => sum + (p.gainPct || 0), 0) /
        openPositions.length
      : 0;

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
    await updatePosition.mutateAsync({
      id: closingPosition,
      status: "CLOSED",
      closePrice: parseFloat(closePrice),
    });
    setClosingPosition(null);
    setClosePrice("");
  };

  const handleDelete = async (id: string) => {
    await deletePosition.mutateAsync(id);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol || !newPrice) return;
    await addPosition.mutateAsync({
      symbol: newSymbol.toUpperCase(),
      entryPrice: parseFloat(newPrice),
    });
    setNewSymbol("");
    setNewPrice("");
    setShowAddForm(false);
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
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
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
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {openPositions.map((p) => (
                  <PositionCard
                    key={p.id}
                    position={p}
                    onClose={handleClose}
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
    </div>
  );
}
