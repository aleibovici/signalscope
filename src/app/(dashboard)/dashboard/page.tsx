"use client";

import { useState, useEffect } from "react";
import { useScans, useScanDetail, type ValidatedTickerData } from "@/hooks/use-scans";
import { ScanSelector } from "@/components/dashboard/scan-selector";
import { StageTabs } from "@/components/dashboard/stage-tabs";
import { SignalCard } from "@/components/dashboard/signal-card";
import { AddPositionModal } from "@/components/dashboard/add-position-modal";
import { Spinner } from "@/components/ui/spinner";

export default function DashboardPage() {
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState("ALL");
  const [trackModal, setTrackModal] = useState<{
    symbol: string;
    price: number;
  } | null>(null);

  const { data: scansData } = useScans(1, 1);
  const { data: scanDetail, isLoading } = useScanDetail(selectedScanId);

  // Auto-select the latest scan
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
