"use client";

import { useState } from "react";
import { useScans, type ScanSummary } from "@/hooks/use-scans";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useScans(page, 20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Scan History</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {(data?.scans || []).map((scan: ScanSummary) => (
              <Link key={scan.id} href={`/dashboard?scanId=${scan.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(scan.startedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {scan.signalCount} signals &middot;{" "}
                        {scan.validatedCount} validated &middot;{" "}
                        {scan.filteredCount} filtered &middot;{" "}
                        AI cost: ${scan.aiCost.toFixed(4)}
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

          {data && data.total > 20 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-500">
                Page {page}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= data.total}
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
