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
      <p className="text-sm text-gray-500">
        No scans yet. Run the harvester to generate signals.
      </p>
    );
  }

  return (
    <select
      value={selectedScanId || ""}
      onChange={(e) => onSelect(e.target.value)}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-auto"
    >
      {scans.map((scan: ScanSummary) => (
        <option key={scan.id} value={scan.id}>
          {new Date(scan.startedAt).toLocaleString()} — {scan.signalCount}{" "}
          signals, {scan.validatedCount} validated
        </option>
      ))}
    </select>
  );
}
