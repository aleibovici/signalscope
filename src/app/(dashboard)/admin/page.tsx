"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminStats } from "@/hooks/use-admin-stats";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const STAGE_ORDER = ["EARLY", "FORMING", "CONFIRMED", "FILTERED", "UNSCORED"];
const STAGE_COLORS: Record<string, string> = {
  EARLY: "text-yellow-600",
  FORMING: "text-orange-600",
  CONFIRMED: "text-green-600",
  FILTERED: "text-red-500",
  UNSCORED: "text-gray-400",
};

const SOURCE_LABELS: Record<string, string> = {
  REDDIT: "Reddit",
  TWITTER: "Twitter / X",
  STOCKTWITS: "StockTwits",
  SEC_INSIDER: "SEC Insider",
  SEC_FILING: "SEC Filing",
  CONGRESS: "Congress",
  VOLUME_SPIKE: "Volume Spike",
  OPTIONS_FLOW: "Options Flow",
};

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          {title}
        </h2>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-gray-100">{children}</div>
      </CardContent>
    </Card>
  );
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useAdminStats();

  // Redirect non-admins once session loads
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading" || (status === "authenticated" && session.user.role !== "admin")) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="mt-1 text-sm text-gray-500">Platform overview</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-stats"] })}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
        >
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load admin stats.
        </div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {/* Users */}
          <SectionCard title="Users">
            <StatRow label="Total" value={data.users.total} />
            <StatRow label="New (7d)" value={data.users.new7d} />
            <StatRow label="New (30d)" value={data.users.new30d} />
            <StatRow label="Email alerts on" value={data.users.emailAlerts} />
            <StatRow label="With API key" value={data.users.withApiKey} />
          </SectionCard>

          {/* Scans */}
          <SectionCard title="Scans">
            <StatRow label="Completed" value={data.scans.completed} />
            <StatRow label="Failed" value={data.scans.failed} />
            <StatRow
              label="Last scan"
              value={
                data.scans.lastScan
                  ? formatRelative(data.scans.lastScan.startedAt)
                  : "—"
              }
            />
            {data.scans.lastScan && (
              <StatRow
                label="Last scan tickers"
                value={data.scans.lastScan.validatedCount ?? "—"}
              />
            )}
            <StatRow
              label="Total AI cost"
              value={`$${data.scans.totalAiCost.toFixed(2)}`}
            />
          </SectionCard>

          {/* Tickers */}
          <SectionCard title="Tickers">
            <StatRow label="Total" value={data.tickers.total} />
            {STAGE_ORDER.map((stage) =>
              data.tickers.byStage[stage] != null ? (
                <div
                  key={stage}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-gray-500">{stage}</span>
                  <span
                    className={`font-semibold ${STAGE_COLORS[stage] ?? "text-gray-900"}`}
                  >
                    {data.tickers.byStage[stage]}
                  </span>
                </div>
              ) : null
            )}
            <StatRow
              label="P&D flagged"
              value={data.tickers.pndFlagged}
            />
          </SectionCard>

          {/* Signals */}
          <SectionCard title="Signals">
            <StatRow label="Total" value={data.signals.total} />
            {Object.entries(data.signals.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => (
                <StatRow
                  key={source}
                  label={SOURCE_LABELS[source] ?? source}
                  value={count}
                />
              ))}
          </SectionCard>

          {/* Engagement */}
          <SectionCard title="Engagement">
            <StatRow label="Open positions" value={data.engagement.openPositions} />
            <StatRow label="Closed positions" value={data.engagement.closedPositions} />
            <StatRow label="Watchlist entries" value={data.engagement.watchlistEntries} />
          </SectionCard>

          {/* System */}
          <SectionCard title="System">
            <StatRow label="Active mobile sessions" value={data.system.activeSessions} />
            <StatRow label="Active API keys" value={data.system.activeApiKeys} />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
