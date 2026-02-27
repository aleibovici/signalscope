"use client";

import { useState, useEffect } from "react";
import { useScans } from "@/hooks/use-scans";

const SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

function formatCountdown(ms: number): string {
  if (ms <= 0) return "due now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatElapsed(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export function NextScanCountdown() {
  const { data } = useScans(1, 1);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const lastScanCompletedAt = data?.scans?.[0]?.completedAt ?? null;

  if (!lastScanCompletedAt) {
    return <p className="text-xs text-gray-400">No scans yet</p>;
  }

  const completedAt = new Date(lastScanCompletedAt).getTime();
  const elapsed = now - completedAt;
  const remaining = SCAN_INTERVAL_MS - elapsed;

  return (
    <div className="text-xs leading-relaxed text-gray-400">
      <p>Last scan {formatElapsed(elapsed)}</p>
      <p>Next ~{formatCountdown(remaining)}</p>
    </div>
  );
}
