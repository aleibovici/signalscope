"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminStats } from "@/hooks/use-admin-stats";
import { useAdminUsers } from "@/hooks/use-admin-users";
import { useAdminPayments } from "@/hooks/use-admin-payments";
import { useAdminCosts } from "@/hooks/use-admin-costs";
import { useAdminXUsage } from "@/hooks/use-admin-x-usage";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { stageLabel } from "@/lib/stage-labels";

const STAGE_ORDER = ["Emerging", "Building", "Consensus", "Filtered", "Unscored"];
const STAGE_COLORS: Record<string, string> = {
  Emerging: "text-green-600 dark:text-green-400",
  Building: "text-yellow-600 dark:text-yellow-400",
  Consensus: "text-blue-600 dark:text-blue-400",
  Filtered: "text-red-500 dark:text-red-400",
  Unscored: "text-gray-400 dark:text-zinc-500",
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
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-gray-500 dark:text-zinc-400">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-zinc-100">{value}</span>
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
      <div className="border-b border-gray-100 px-3 py-2 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          {title}
        </h2>
      </div>
      <div className="px-3 py-2">
        <div className="divide-y divide-gray-50 dark:divide-zinc-800/80">{children}</div>
      </div>
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
  const { data: usersData, isLoading: usersLoading } = useAdminUsers();
  const { data: paymentsData } = useAdminPayments();
  const { data: costsData } = useAdminCosts();
  const { data: xUsageData } = useAdminXUsage();

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

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Admin</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Platform overview</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
            queryClient.invalidateQueries({ queryKey: ["admin-costs"] });
            queryClient.invalidateQueries({ queryKey: ["admin-x-usage"] });
          }}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-800"
        >
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="text-blue-600 dark:text-blue-400" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          Failed to load admin stats.
        </div>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Users */}
          <SectionCard title="Users">
            <StatRow label="Total" value={data.users.total} />
            <StatRow label="New (7d)" value={data.users.new7d} />
            <StatRow label="New (30d)" value={data.users.new30d} />
            <StatRow label="Email alerts on" value={data.users.emailAlerts} />
            <StatRow label="With API key" value={data.users.withApiKey} />
            <StatRow label="Pro subscribers" value={data.users.proSubscribers} />
            <StatRow label="Churned" value={data.users.churned} />
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
                  className="flex items-center justify-between py-0.5 text-xs"
                >
                  <span className="text-gray-500 dark:text-zinc-400">{stageLabel(stage)}</span>
                  <span
                    className={`font-semibold ${STAGE_COLORS[stage] ?? "text-gray-900 dark:text-zinc-100"}`}
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

          {/* x402 Payments */}
          {paymentsData && (
            <SectionCard title="x402 Payments">
              <StatRow label="Total payments" value={paymentsData.total} />
              <StatRow
                label="All-time revenue"
                value={`$${paymentsData.allTimeRevenue.toFixed(4)}`}
              />
              <StatRow
                label="Last 7d payments"
                value={paymentsData.last7d.count}
              />
              <StatRow
                label="Last 7d revenue"
                value={`$${paymentsData.last7d.revenue.toFixed(4)}`}
              />
              <StatRow
                label="Last 30d payments"
                value={paymentsData.last30d.count}
              />
              <StatRow
                label="Last 30d revenue"
                value={`$${paymentsData.last30d.revenue.toFixed(4)}`}
              />
            </SectionCard>
          )}
        </div>
      )}

      {/* x402 Payments by Endpoint */}
      {paymentsData && paymentsData.byEndpoint.length > 0 && (
        <Card>
          <div className="border-b border-gray-100 px-3 py-2 dark:border-zinc-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              x402 Revenue by Endpoint
            </h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left font-medium uppercase tracking-wide text-gray-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-500">
                <th className="px-3 py-1.5">Endpoint</th>
                <th className="px-3 py-1.5 text-right">Price</th>
                <th className="px-3 py-1.5 text-right">Calls</th>
                <th className="px-3 py-1.5 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/80">
              {paymentsData.byEndpoint
                .sort((a, b) => b.revenue - a.revenue)
                .map((ep) => (
                  <tr key={ep.endpoint} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                    <td className="px-3 py-1 font-medium text-gray-900 dark:text-zinc-100">{ep.endpoint}</td>
                    <td className="px-3 py-1 text-right text-gray-500 dark:text-zinc-400">${ep.amountUsd}</td>
                    <td className="px-3 py-1 text-right text-gray-700 dark:text-zinc-300">{ep.count}</td>
                    <td className="px-3 py-1 text-right font-semibold text-green-700 dark:text-green-400">${ep.revenue.toFixed(4)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Recent x402 Payments */}
      {paymentsData && (
        <Card>
          <div className="border-b border-gray-100 px-3 py-2 dark:border-zinc-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Recent x402 Payments
            </h2>
          </div>
          {paymentsData.recentPayments.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400 dark:text-zinc-500">No x402 payments yet.</p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left font-medium uppercase tracking-wide text-gray-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-500">
                    <th className="px-3 py-1.5">Time</th>
                    <th className="px-3 py-1.5">Endpoint</th>
                    <th className="px-3 py-1.5 text-right">Amount</th>
                    <th className="hidden md:table-cell px-3 py-1.5">Payer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/80">
                  {paymentsData.recentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                      <td className="px-3 py-1 whitespace-nowrap text-gray-500 dark:text-zinc-400">{formatRelative(p.createdAt)}</td>
                      <td className="px-3 py-1 font-medium text-gray-900 dark:text-zinc-100">{p.endpoint}</td>
                      <td className="px-3 py-1 text-right font-semibold text-green-700 dark:text-green-400">${p.amountUsd}</td>
                      <td className="hidden max-w-[180px] truncate px-3 py-1 font-mono text-gray-400 dark:text-zinc-500 md:table-cell">
                        {p.payerAddress ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* AI Costs */}
      {costsData && (
        <Card>
          <div className="border-b border-gray-100 px-3 py-2 dark:border-zinc-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">AI Costs</h2>
          </div>

          {/* Period totals */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-zinc-800">
            {[
              { label: "All time", ...costsData.totals.allTime },
              { label: "Last 30d", ...costsData.totals.last30d },
              { label: "Last 7d", ...costsData.totals.last7d },
            ].map(({ label, cost, calls }) => (
              <div key={label} className="px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-orange-600 dark:text-orange-400">${cost.toFixed(4)}</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">{calls} calls</p>
              </div>
            ))}
          </div>

          {/* By call point + by trigger */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 dark:divide-zinc-800 dark:border-zinc-800">
            <div>
              <p className="border-b border-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-zinc-800/60 dark:text-zinc-500">
                By call point
              </p>
              <div className="divide-y divide-gray-50 px-3 py-1 dark:divide-zinc-800/60">
                {costsData.byCallPoint.length === 0 ? (
                  <p className="py-2 text-[10px] text-gray-400 dark:text-zinc-500">No data yet</p>
                ) : costsData.byCallPoint.map((r) => (
                  <div key={r.callPoint} className="flex items-center justify-between py-0.5 text-xs">
                    <span className="text-gray-600 dark:text-zinc-300">{r.callPoint}</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">${r.cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="border-b border-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-zinc-800/60 dark:text-zinc-500">
                By trigger
              </p>
              <div className="divide-y divide-gray-50 px-3 py-1 dark:divide-zinc-800/60">
                {costsData.byTrigger.length === 0 ? (
                  <p className="py-2 text-[10px] text-gray-400 dark:text-zinc-500">No data yet</p>
                ) : costsData.byTrigger.map((r) => (
                  <div key={r.trigger} className="flex items-center justify-between py-0.5 text-xs">
                    <span className="text-gray-600 dark:text-zinc-300">{r.trigger}</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">${r.cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per-harvest table */}
          {costsData.recentScans.length > 0 && (
            <div className="border-t border-gray-100 dark:border-zinc-800">
              <p className="border-b border-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-zinc-800/60 dark:text-zinc-500">
                Per harvest (last 30d)
              </p>
              <div className="max-h-[200px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50 text-left font-medium uppercase tracking-wide text-gray-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-500">
                      <th className="px-3 py-1">Date</th>
                      <th className="px-3 py-1 text-right">Scoring</th>
                      <th className="px-3 py-1 text-right">P&D</th>
                      <th className="px-3 py-1 text-right">Reports</th>
                      <th className="px-3 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                    {costsData.recentScans.map((s) => (
                      <tr key={s.scanId} className="hover:bg-gray-50 dark:hover:bg-zinc-900/40">
                        <td className="whitespace-nowrap px-3 py-1 text-gray-500 dark:text-zinc-400">{s.startedAt ? formatDate(s.startedAt) : "—"}</td>
                        <td className="px-3 py-1 text-right text-gray-600 dark:text-zinc-300">${s.scoring.toFixed(4)}</td>
                        <td className="px-3 py-1 text-right text-gray-600 dark:text-zinc-300">${s.pnd.toFixed(4)}</td>
                        <td className="px-3 py-1 text-right text-gray-600 dark:text-zinc-300">${s.report.toFixed(4)}</td>
                        <td className="px-3 py-1 text-right font-semibold text-orange-600 dark:text-orange-400">${s.total.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* On-demand by user */}
          {costsData.onDemandByUser.length > 0 && (
            <div className="border-t border-gray-100 dark:border-zinc-800">
              <p className="border-b border-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-zinc-800/60 dark:text-zinc-500">
                On-demand by user (last 30d)
              </p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                  {costsData.onDemandByUser.map((u) => (
                    <tr key={u.userId ?? "anon"} className="hover:bg-gray-50 dark:hover:bg-zinc-900/40">
                      <td className="max-w-[200px] truncate px-3 py-1 text-gray-600 dark:text-zinc-300">{u.email}</td>
                      <td className="px-3 py-1 text-right text-gray-400 dark:text-zinc-500">{u.calls} reports</td>
                      <td className="px-3 py-1 text-right font-semibold text-orange-600 dark:text-orange-400">${u.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* X API Usage */}
      {xUsageData && (
        <Card>
          <div className="border-b border-gray-100 px-3 py-2 dark:border-zinc-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">X / Twitter API Usage</h2>
          </div>

          {/* Period totals */}
          <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-zinc-800">
            {[
              { label: "All time", ...xUsageData.totals.allTime },
              { label: "Last 30d", ...xUsageData.totals.last30d },
              { label: "Last 7d", ...xUsageData.totals.last7d },
              { label: "Last 24h", ...xUsageData.totals.last24h },
            ].map(({ label, calls }) => (
              <div key={label} className="px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-sky-600 dark:text-sky-400">{calls}</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">API calls</p>
              </div>
            ))}
          </div>

          {xUsageData.errors7d > 0 && (
            <div className="border-t border-gray-100 px-3 py-1.5 dark:border-zinc-800">
              <p className="text-xs text-red-600 dark:text-red-400">
                {xUsageData.errors7d} errors in last 7d
              </p>
            </div>
          )}

          {/* By action + by endpoint */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 dark:divide-zinc-800 dark:border-zinc-800">
            <div>
              <p className="border-b border-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-zinc-800/60 dark:text-zinc-500">
                By action
              </p>
              <div className="divide-y divide-gray-50 px-3 py-1 dark:divide-zinc-800/60">
                {xUsageData.byAction.length === 0 ? (
                  <p className="py-2 text-[10px] text-gray-400 dark:text-zinc-500">No data yet</p>
                ) : xUsageData.byAction.map((r) => (
                  <div key={r.action} className="flex items-center justify-between py-0.5 text-xs">
                    <span className="text-gray-600 dark:text-zinc-300">{r.action}</span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">{r.calls}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="border-b border-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-zinc-800/60 dark:text-zinc-500">
                By endpoint
              </p>
              <div className="divide-y divide-gray-50 px-3 py-1 dark:divide-zinc-800/60">
                {xUsageData.byEndpoint.length === 0 ? (
                  <p className="py-2 text-[10px] text-gray-400 dark:text-zinc-500">No data yet</p>
                ) : xUsageData.byEndpoint.map((r) => (
                  <div key={r.endpoint} className="flex items-center justify-between py-0.5 text-xs">
                    <span className="text-gray-600 dark:text-zinc-300">{r.endpoint}</span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">{r.calls}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent logs */}
          {xUsageData.recentLogs.length > 0 && (
            <div className="border-t border-gray-100 dark:border-zinc-800">
              <p className="border-b border-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-zinc-800/60 dark:text-zinc-500">
                Recent API calls
              </p>
              <div className="max-h-[200px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50 text-left font-medium uppercase tracking-wide text-gray-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-500">
                      <th className="px-3 py-1">Time</th>
                      <th className="px-3 py-1">Action</th>
                      <th className="px-3 py-1">Endpoint</th>
                      <th className="px-3 py-1 text-right">Calls</th>
                      <th className="px-3 py-1 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                    {xUsageData.recentLogs.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/40">
                        <td className="whitespace-nowrap px-3 py-1 text-gray-500 dark:text-zinc-400">{formatRelative(l.createdAt)}</td>
                        <td className="px-3 py-1 font-medium text-gray-900 dark:text-zinc-100">{l.action}</td>
                        <td className="px-3 py-1 text-gray-500 dark:text-zinc-400">{l.method} {l.endpoint}</td>
                        <td className="px-3 py-1 text-right text-gray-700 dark:text-zinc-300">{l.count}</td>
                        <td className={`px-3 py-1 text-right font-medium ${
                          l.statusCode && l.statusCode >= 400
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }`}>
                          {l.statusCode ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Users Table */}
      <UsersTable users={usersData?.users} loading={usersLoading} formatDate={formatDate} />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UsersTable({ users, loading, formatDate }: { users: any[] | undefined; loading: boolean; formatDate: (d: string) => string }) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<"all" | "pro" | "free">("all");

  const filtered = useMemo(() => {
    if (!users) return [];
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.username && u.username.toLowerCase().includes(q))
      );
    }
    if (filterPlan === "pro") {
      list = list.filter(
        (u) => u.subscription && (u.subscription.status === "ACTIVE" || u.subscription.status === "PAST_DUE")
      );
    } else if (filterPlan === "free") {
      list = list.filter(
        (u) => !u.subscription || (u.subscription.status !== "ACTIVE" && u.subscription.status !== "PAST_DUE")
      );
    }
    return list;
  }, [users, search, filterPlan]);

  const activeCount = users?.filter((u) => {
    if (!u.lastActiveAt) return false;
    return Date.now() - new Date(u.lastActiveAt).getTime() < 7 * 86_400_000;
  }).length ?? 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          Registered Users
        </h2>
        {users && (
          <span className="text-[10px] text-gray-400 dark:text-zinc-500">
            {users.length} total · {activeCount} active 7d
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value as "all" | "pro" | "free")}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="all">All plans</option>
            <option value="pro">Pro only</option>
            <option value="free">Free only</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or username…"
            className="w-48 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 placeholder-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder-zinc-500"
          />
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="text-blue-600 dark:text-blue-400" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-100 bg-gray-50 text-left font-medium uppercase tracking-wide text-gray-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-500">
                <th className="px-3 py-1.5">Email</th>
                <th className="hidden sm:table-cell px-3 py-1.5">Username</th>
                <th className="px-3 py-1.5">Joined</th>
                <th className="px-3 py-1.5 text-center">Plan</th>
                <th className="hidden md:table-cell px-3 py-1.5 text-right">Pos</th>
                <th className="hidden md:table-cell px-3 py-1.5 text-right">Watch</th>
                <th className="hidden md:table-cell px-3 py-1.5 text-center">Alerts</th>
                <th className="hidden md:table-cell px-3 py-1.5 text-center">API Key</th>
                <th className="px-3 py-1.5 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/80">
              {filtered.map((u) => {
                const active7d = u.lastActiveAt && Date.now() - new Date(u.lastActiveAt).getTime() < 7 * 86_400_000;
                const active24h = u.lastActiveAt && Date.now() - new Date(u.lastActiveAt).getTime() < 86_400_000;
                return (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                    <td className="max-w-[160px] truncate px-3 py-1 font-medium text-gray-900 dark:text-zinc-100">
                      <span className="flex items-center gap-1.5">
                        <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${active24h ? "bg-green-500" : active7d ? "bg-yellow-500" : "bg-gray-300 dark:bg-zinc-600"}`} />
                        {u.email}
                      </span>
                    </td>
                    <td className="hidden px-3 py-1 text-gray-500 dark:text-zinc-400 sm:table-cell">{u.username ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1 text-gray-500 dark:text-zinc-400">{formatDate(u.createdAt)}</td>
                    <td className="px-3 py-1 text-center">
                      {u.subscription && (u.subscription.status === "ACTIVE" || u.subscription.status === "PAST_DUE") ? (
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          u.subscription.cancelAtPeriodEnd
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : u.subscription.status === "PAST_DUE"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        }`}>
                          {u.subscription.cancelAtPeriodEnd ? "Canceling" : u.subscription.status === "PAST_DUE" ? "Past Due" : "Pro"}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-zinc-600">Free</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-1 text-right text-gray-700 dark:text-zinc-300 md:table-cell">{u._count.positions}</td>
                    <td className="hidden px-3 py-1 text-right text-gray-700 dark:text-zinc-300 md:table-cell">{u._count.watchlist}</td>
                    <td className="hidden px-3 py-1 text-center md:table-cell">
                      <span className={u.emailAlerts ? "text-green-600 dark:text-green-400" : "text-gray-300 dark:text-zinc-600"}>
                        {u.emailAlerts ? "On" : "Off"}
                      </span>
                    </td>
                    <td className="hidden px-3 py-1 text-center md:table-cell">
                      <span className={u._count.apiKeys > 0 ? "text-green-600 dark:text-green-400" : "text-gray-300 dark:text-zinc-600"}>
                        {u._count.apiKeys > 0 ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1 text-right text-gray-500 dark:text-zinc-400">
                      {u.lastActiveAt ? formatRelative(u.lastActiveAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-3 py-4 text-xs text-gray-400 dark:text-zinc-500">
          {search || filterPlan !== "all" ? "No users match your filters." : "No users found."}
        </p>
      )}
    </Card>
  );
}
