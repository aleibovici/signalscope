"use client";

import { useState, useEffect } from "react";
import { useScans } from "@/hooks/use-scans";

// Scan runs Mon–Fri at 9:00 AM America/New_York
function getNextScanTime(now: Date): Date {
  for (let deltaDays = 0; deltaDays <= 7; deltaDays++) {
    const probe = new Date(now.getTime() + deltaDays * 86_400_000);

    const etParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(probe);

    const weekday = etParts.find((p) => p.type === "weekday")!.value;
    if (weekday === "Sat" || weekday === "Sun") continue;

    const y = +etParts.find((p) => p.type === "year")!.value;
    const mo = +etParts.find((p) => p.type === "month")!.value;
    const d = +etParts.find((p) => p.type === "day")!.value;

    // Try EST (UTC-5 → 14:00 UTC) then EDT (UTC-4 → 13:00 UTC)
    for (const utcHour of [14, 13]) {
      const candidate = new Date(Date.UTC(y, mo - 1, d, utcHour, 0, 0));
      const etHour = +new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(candidate);
      if (etHour === 9 && candidate > now) return candidate;
    }
  }
  return new Date(now.getTime() + 86_400_000);
}

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
  const nextScan = getNextScanTime(new Date(now));
  const remaining = nextScan.getTime() - now;

  return (
    <div className="text-xs leading-relaxed text-gray-400">
      {lastScanCompletedAt && (
        <p>Last scan {formatElapsed(now - new Date(lastScanCompletedAt).getTime())}</p>
      )}
      <p>Next ~{formatCountdown(remaining)} (9 AM ET)</p>
    </div>
  );
}
