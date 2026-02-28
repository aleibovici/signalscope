"use client";

import { useState } from "react";
import { useScans, type ScanSummary, type ScansFilter } from "@/hooks/use-scans";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ScansFilter>({});
  const { data, isLoading } = useScans(page, PAGE_SIZE, filters);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  function updateFilter(patch: Partial<ScansFilter>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      // Remove empty values
      for (const key of Object.keys(next) as (keyof ScansFilter)[]) {
        if (!next[key]) delete next[key];
      }
      return next;
    });
    setPage(1);
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Scan History</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
          <select
            value={filters.status || ""}
            onChange={(e) => updateFilter({ status: e.target.value || undefined })}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="RUNNING">Running</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={filters.from || ""}
            onChange={(e) => updateFilter({ from: e.target.value || undefined })}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={filters.to || ""}
            onChange={(e) => updateFilter({ to: e.target.value || undefined })}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {(filters.status || filters.from || filters.to) && (
          <button
            onClick={() => { setFilters({}); setPage(1); }}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : !data?.scans.length ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No scans found{(filters.status || filters.from || filters.to) ? " matching your filters" : ""}.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {data.scans.map((scan: ScanSummary) => (
              <Link key={scan.id} href={`/dashboard?scanId=${scan.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(scan.startedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {scan.signalCount} signals &middot;{" "}
                        {scan.validatedCount} validated &middot;{" "}
                        {scan.filteredCount} filtered
                      </p>
                    </div>
                    <Badge
                      variant={
                        scan.status === "COMPLETED"
                          ? "success"
                          : scan.status === "FAILED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {scan.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
