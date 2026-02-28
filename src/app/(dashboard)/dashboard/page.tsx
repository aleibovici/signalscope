"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useScans, useScanDetail, type ValidatedTickerData } from "@/hooks/use-scans";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { ScanSelector } from "@/components/dashboard/scan-selector";
import { StageTabs } from "@/components/dashboard/stage-tabs";
import { SignalCard } from "@/components/dashboard/signal-card";
import { AddPositionModal } from "@/components/dashboard/add-position-modal";
import { Spinner } from "@/components/ui/spinner";

function DashboardContent() {
  const searchParams = useSearchParams();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(
    searchParams.get("scanId")
  );
  const [selectedStage, setSelectedStage] = useState("ALL");
  const [trackModal, setTrackModal] = useState<{
    symbol: string;
    price: number;
  } | null>(null);

  useScrollRestore("dashboard");

  const { data: scansData } = useScans(1, 1);
  const { data: scanDetail, isLoading, isError } = useScanDetail(selectedScanId);

  // Auto-select the latest scan only if no scanId was provided via URL
  useEffect(() => {
    if (!selectedScanId && scansData?.scans?.[0]) {
      setSelectedScanId(scansData.scans[0].id);
    }
  }, [scansData, selectedScanId]);

  const tickers = scanDetail?.tickers || [];
  const filtered =
    selectedStage === "ALL"
      ? tickers.filter((t) => t.stage !== "FILTERED")
      : tickers.filter((t) => t.stage === selectedStage);

  const counts: Record<string, number> = {
    ALL: tickers.filter((t) => t.stage !== "FILTERED").length,
    EARLY: tickers.filter((t) => t.stage === "EARLY").length,
    FORMING: tickers.filter((t) => t.stage === "FORMING").length,
    CONFIRMED: tickers.filter((t) => t.stage === "CONFIRMED").length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Signal Dashboard</h1>
        <ScanSelector
          selectedScanId={selectedScanId}
          onSelect={setSelectedScanId}
        />
      </div>

      <StageTabs
        selected={selectedStage}
        onSelect={setSelectedStage}
        counts={counts}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center">
          <p className="text-red-600">Failed to load signals. Please refresh and try again.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">
            {selectedScanId
              ? "No signals found for this stage."
              : "No scans available. Run the harvester to detect breakout signals."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ticker: ValidatedTickerData) => (
            <SignalCard
              key={ticker.id}
              ticker={ticker}
              onTrack={(symbol, price) => setTrackModal({ symbol, price })}
            />
          ))}
        </div>
      )}

      {trackModal && (
        <AddPositionModal
          symbol={trackModal.symbol}
          price={trackModal.price}
          onClose={() => setTrackModal(null)}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-blue-600" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
