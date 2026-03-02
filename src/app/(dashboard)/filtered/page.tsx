"use client";

import { useState } from "react";
import { useScans, useScanDetail, type ValidatedTickerData } from "@/hooks/use-scans";
import { ScanSelector } from "@/components/dashboard/scan-selector";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

export default function FilteredPage() {
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const { data: scansData } = useScans(1, 1);
  const effectiveScanId = selectedScanId ?? scansData?.scans?.[0]?.id ?? null;
  const { data: scanDetail, isLoading, isError } = useScanDetail(effectiveScanId, true);

  const filtered = (scanDetail?.tickers || []).filter(
    (t) => t.stage === "FILTERED"
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Filtered Tickers (P&D)
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            These tickers were flagged as potential pump-and-dump schemes.
          </p>
        </div>
        <ScanSelector
          selectedScanId={effectiveScanId}
          onSelect={setSelectedScanId}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center">
          <p className="text-red-600">Failed to load filtered tickers. Please refresh and try again.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">No filtered tickers in this scan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticker: ValidatedTickerData) => (
            <Card key={ticker.id}>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">
                      {ticker.symbol}
                    </span>
                    <Badge variant="danger">FILTERED</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Score: {ticker.aiScore}/100 &middot;{" "}
                    {ticker.signalCount} signals from {ticker.sourceCount}{" "}
                    sources
                  </p>
                  {ticker.catalyst && (
                    <p className="mt-1 text-sm text-gray-600">
                      {ticker.catalyst}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {ticker.price && (
                    <p className="font-medium">${ticker.price.toFixed(2)}</p>
                  )}
                  {ticker.marketCap && (
                    <p className="text-xs text-gray-400">
                      MCap: ${(ticker.marketCap / 1e6).toFixed(1)}M
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
