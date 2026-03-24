"use client";

import { useScans, type ScanSummary } from "@/hooks/use-scans";
import { Spinner } from "@/components/ui/spinner";

export function ScanSelector({
  selectedScanId,
  onSelect,
}: {
  selectedScanId: string | null;
  onSelect: (scanId: string) => void;
}) {
  const { data, isLoading } = useScans(1, 7);

  if (isLoading) return <Spinner />;

  const scans = (data?.scans || []).filter(scan => scan.signalCount > 0);

  if (scans.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-zinc-400">
        No scans yet. Run a scan to generate signals.
      </p>
    );
  }

  const selectedScan = scans.find((s) => s.id === selectedScanId) ?? scans[0];

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      {selectedScan && (
        <p className="shrink-0 text-xs tabular-nums text-gray-400 dark:text-zinc-500 sm:text-right sm:text-sm">
          {selectedScan.signalCount} signals
          <span className="mx-1.5 text-gray-300 dark:text-zinc-600">|</span>
          {selectedScan.validatedCount} validated
        </p>
      )}
      <select
        value={selectedScanId || ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:w-auto"
      >
        {scans.map((scan: ScanSummary) => (
          <option key={scan.id} value={scan.id}>
            {new Date(scan.startedAt).toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
}
