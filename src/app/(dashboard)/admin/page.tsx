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

const STAGE_TEXT: Record<string, string> = {
  Emerging:  "text-stage-early",
  Building:  "text-stage-forming",
  Consensus: "text-stage-confirmed",
  Filtered:  "text-stage-filtered",
  Unscored:  "text-stage-unscored",
};

const STAGE_COLOR_VAR: Record<string, string> = {
  Emerging:  "var(--color-stage-early)",
  Building:  "var(--color-stage-forming)",
  Consensus: "var(--color-stage-confirmed)",
  Filtered:  "var(--color-stage-filtered)",
  Unscored:  "var(--color-stage-unscored)",
};

const SOURCE_LABELS: Record<string, string> = {
  REDDIT:       "Reddit",
  TWITTER:      "Twitter / X",
  STOCKTWITS:   "StockTwits",
  SEC_INSIDER:  "SEC Insider",
  SEC_FILING:   "SEC Filing",
  CONGRESS:     "Congress",
  VOLUME_SPIKE: "Volume Spike",
  OPTIONS_FLOW: "Options Flow",
  POLYMARKET:   "Polymarket",
};

function formatRelative(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SectionLabel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${accent ?? "text-muted"}`}>
      {children}
    </p>
  );
}

function CardHead({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="border-b border-border-default px-4 py-2.5">
      <SectionLabel accent={accent}>{children}</SectionLabel>
    </div>
  );
}

function MetricRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-[3px] text-xs">
      <span className="text-secondary">{label}</span>
      <span className={`font-mono tabular-nums font-semibold ${valueClass ?? "text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  colorVar,
  textClass,
}: {
  label: string;
  value: number;
  max: number;
  colorVar: string;
  textClass?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-[3px] text-xs">
      <span className={`w-[76px] shrink-0 truncate ${textClass ?? "text-secondary"}`}>{label}</span>
      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full transition-[width] duration-slow"
          style={{ width: `${pct}%`, backgroundColor: colorVar }}
        />
      </div>
      <span className={`w-9 shrink-0 text-right font-mono tabular-nums font-semibold ${textClass ?? "text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error } = useAdminStats();
  const { data: usersData, isLoading: usersLoading } = useAdminUsers();
  const { data: paymentsData } = useAdminPayments();
  const { data: costsData } = useAdminCosts();
  const { data: xUsageData } = useAdminXUsage();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading" || (status === "authenticated" && session.user.role !== "admin")) {
    return null;
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    queryClient.invalidateQueries({ queryKey: ["admin-costs"] });
    queryClient.invalidateQueries({ queryKey: ["admin-x-usage"] });
  }

  const stageTotal = data
    ? Object.values(data.tickers.byStage).reduce((a, b) => a + b, 0)
    : 0;

  const sourceEntries = data
    ? Object.entries(data.signals.bySource).sort((a, b) => b[1] - a[1])
    : [];
  const maxSource = sourceEntries.length > 0 ? sourceEntries[0][1] : 1;

  const proPct =
    data && data.users.total > 0
      ? Math.round((data.users.proSubscribers / data.users.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-h1 text-primary">Admin</h1>
          <p className="mt-0.5 text-xs text-muted">Platform command center</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-card border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-label transition-colors duration-base hover:bg-surface-subtle active:bg-surface-muted disabled:opacity-60"
        >
          {isFetching ? (
            <span className="inline-block h-2 w-2 rounded-full border border-info border-t-transparent animate-spin" />
          ) : (
            <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
          )}
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="text-info" />
        </div>
      )}

      {error && (
        <div className="rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
          Failed to load admin stats.
        </div>
      )}

      {data && (
        <>
          {/* ── Hero KPI strip ── */}
          <Card>
            <div className="grid grid-cols-2 divide-border-default sm:grid-cols-4 sm:divide-x">
              {[
                {
                  label: "Total Users",
                  value: data.users.total.toLocaleString(),
                  sub: `+${data.users.new7d} this week`,
                  accent: "text-info",
                },
                {
                  label: "Pro Subscribers",
                  value: data.users.proSubscribers.toLocaleString(),
                  sub: `${proPct}% conversion`,
                  accent: "text-success",
                },
                {
                  label: "Last Scan",
                  value: data.scans.lastScan
                    ? formatRelative(data.scans.lastScan.startedAt)
                    : "—",
                  sub: data.scans.lastScan
                    ? `${data.scans.lastScan.validatedCount ?? 0} tickers`
                    : "no scans yet",
                  accent: "text-primary",
                },
                {
                  label: "7d AI Cost",
                  value: costsData
                    ? `$${costsData.totals.last7d.cost.toFixed(3)}`
                    : "—",
                  sub: costsData
                    ? `$${costsData.totals.allTime.cost.toFixed(2)} all-time`
                    : "loading…",
                  accent: "text-warning",
                },
              ].map(({ label, value, sub, accent }, i) => (
                <div
                  key={label}
                  className={`px-5 py-4 ${i < 2 ? "border-b border-border-default sm:border-b-0" : ""}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                    {label}
                  </p>
                  <p
                    className={`mt-1.5 font-mono text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${accent}`}
                  >
                    {value}
                  </p>
                  <p className="mt-1 text-[11px] text-secondary">{sub}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Operations grid ── */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Users */}
            <Card>
              <CardHead>Users</CardHead>
              <div className="space-y-0.5 px-4 py-3">
                <MetricRow
                  label="Total"
                  value={data.users.total.toLocaleString()}
                  valueClass="text-info"
                />
                <MetricRow
                  label="New (7d)"
                  value={data.users.new7d}
                  valueClass="text-success"
                />
                <MetricRow label="New (30d)" value={data.users.new30d} />
                <MetricRow label="Email alerts on" value={data.users.emailAlerts} />
                <MetricRow label="With API key" value={data.users.withApiKey} />
                <MetricRow
                  label="Pro subscribers"
                  value={data.users.proSubscribers}
                  valueClass="text-success"
                />
                <MetricRow
                  label="Churned"
                  value={data.users.churned}
                  valueClass={data.users.churned > 0 ? "text-danger" : "text-muted"}
                />
              </div>
            </Card>

            {/* Scans + System */}
            <Card>
              <CardHead>Scans</CardHead>
              <div className="space-y-0.5 px-4 py-3">
                <MetricRow
                  label="Completed"
                  value={data.scans.completed}
                  valueClass="text-success"
                />
                <MetricRow
                  label="Failed"
                  value={data.scans.failed}
                  valueClass={data.scans.failed > 0 ? "text-danger" : "text-muted"}
                />
                <MetricRow
                  label="Last scan"
                  value={
                    data.scans.lastScan
                      ? formatRelative(data.scans.lastScan.startedAt)
                      : "—"
                  }
                />
                {data.scans.lastScan && (
                  <MetricRow
                    label="Tickers validated"
                    value={data.scans.lastScan.validatedCount ?? "—"}
                  />
                )}
                <MetricRow
                  label="Total AI cost"
                  value={`$${data.scans.totalAiCost.toFixed(2)}`}
                  valueClass="text-warning"
                />
              </div>
              <div className="border-t border-border-default px-4 py-3">
                <SectionLabel>System</SectionLabel>
                <div className="mt-2 space-y-0.5">
                  <MetricRow
                    label="Active mobile sessions"
                    value={data.system.activeSessions}
                  />
                  <MetricRow label="Active API keys" value={data.system.activeApiKeys} />
                  <MetricRow label="Open positions" value={data.engagement.openPositions} />
                  <MetricRow
                    label="Watchlist entries"
                    value={data.engagement.watchlistEntries}
                  />
                </div>
              </div>
            </Card>

            {/* Tickers with stage bars */}
            <Card>
              <CardHead>
                Tickers{" "}
                <span className="font-mono tabular-nums normal-case tracking-normal">
                  — {data.tickers.total.toLocaleString()} total
                </span>
              </CardHead>
              <div className="px-4 py-3">
                <div className="space-y-1">
                  {STAGE_ORDER.map((stage) => (
                    <BarRow
                      key={stage}
                      label={stageLabel(stage)}
                      value={data.tickers.byStage[stage] ?? 0}
                      max={stageTotal}
                      colorVar={STAGE_COLOR_VAR[stage]}
                      textClass={STAGE_TEXT[stage]}
                    />
                  ))}
                </div>
                <div className="mt-3 border-t border-border-default pt-3">
                  <MetricRow
                    label="P&D flagged"
                    value={data.tickers.pndFlagged}
                    valueClass={
                      data.tickers.pndFlagged > 0 ? "text-danger" : "text-muted"
                    }
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* ── Signals by source ── */}
          <Card>
            <CardHead>
              Signals{" "}
              <span className="font-mono tabular-nums normal-case tracking-normal">
                — {data.signals.total.toLocaleString()} total
              </span>
            </CardHead>
            <div className="px-4 py-3">
              <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                {sourceEntries.map(([source, count]) => (
                  <BarRow
                    key={source}
                    label={SOURCE_LABELS[source] ?? source}
                    value={count}
                    max={maxSource}
                    colorVar="var(--color-info)"
                    textClass="text-secondary"
                  />
                ))}
              </div>
            </div>
          </Card>

          {/* ── Payments ── */}
          {paymentsData && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHead accent="text-warning">x402 Payments</CardHead>
                <div className="grid grid-cols-3 divide-x divide-border-default border-b border-border-default">
                  {[
                    {
                      label: "All time",
                      count: paymentsData.total,
                      rev: paymentsData.allTimeRevenue,
                    },
                    {
                      label: "Last 30d",
                      count: paymentsData.last30d.count,
                      rev: paymentsData.last30d.revenue,
                    },
                    {
                      label: "Last 7d",
                      count: paymentsData.last7d.count,
                      rev: paymentsData.last7d.revenue,
                    },
                  ].map(({ label, count, rev }) => (
                    <div key={label} className="px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                        {label}
                      </p>
                      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-warning">
                        ${rev.toFixed(4)}
                      </p>
                      <p className="font-mono text-[10px] text-muted">{count} calls</p>
                    </div>
                  ))}
                </div>
                {paymentsData.byEndpoint.length > 0 && (
                  <div className="px-4 py-3">
                    <SectionLabel>By endpoint</SectionLabel>
                    <div className="mt-2 space-y-0.5">
                      {paymentsData.byEndpoint
                        .sort((a, b) => b.revenue - a.revenue)
                        .map((ep) => (
                          <div
                            key={ep.endpoint}
                            className="flex items-center justify-between py-[3px] text-xs"
                          >
                            <span className="max-w-[160px] truncate text-secondary">
                              {ep.endpoint}
                            </span>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="font-mono tabular-nums text-muted">
                                {ep.count}×
                              </span>
                              <span className="w-16 text-right font-mono tabular-nums font-semibold text-warning">
                                ${ep.revenue.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <CardHead>Recent x402 Payments</CardHead>
                {paymentsData.recentPayments.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted">
                    No payments yet.
                  </p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface-card">
                        <tr className="border-b border-border-default">
                          <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-muted">
                            Time
                          </th>
                          <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-muted">
                            Endpoint
                          </th>
                          <th className="px-4 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-muted">
                            Amt
                          </th>
                          <th className="hidden px-4 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-muted md:table-cell">
                            Payer
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default">
                        {paymentsData.recentPayments.map((p) => (
                          <tr
                            key={p.id}
                            className="transition-colors duration-fast hover:bg-surface-subtle"
                          >
                            <td className="whitespace-nowrap px-4 py-1.5 font-mono tabular-nums text-muted">
                              {formatRelative(p.createdAt)}
                            </td>
                            <td className="max-w-[140px] truncate px-4 py-1.5 text-label">
                              {p.endpoint}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono tabular-nums font-semibold text-warning">
                              ${p.amountUsd}
                            </td>
                            <td className="hidden max-w-[140px] truncate px-4 py-1.5 font-mono text-muted md:table-cell">
                              {p.payerAddress ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── AI Costs ── */}
          {costsData && (
            <Card>
              <CardHead accent="text-warning">AI Costs</CardHead>

              <div className="grid grid-cols-3 divide-x divide-border-default border-b border-border-default">
                {[
                  { label: "All time", ...costsData.totals.allTime },
                  { label: "Last 30d", ...costsData.totals.last30d },
                  { label: "Last 7d", ...costsData.totals.last7d },
                ].map(({ label, cost, calls }) => (
                  <div key={label} className="px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                      {label}
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums text-warning">
                      ${cost.toFixed(4)}
                    </p>
                    <p className="font-mono text-[10px] text-muted">{calls} calls</p>
                  </div>
                ))}
              </div>

              <div className="grid divide-x divide-border-default sm:grid-cols-2">
                <div className="px-4 py-3">
                  <SectionLabel>By call point</SectionLabel>
                  <div className="mt-2 space-y-0.5">
                    {costsData.byCallPoint.length === 0 ? (
                      <p className="py-1 text-[10px] text-muted">No data yet</p>
                    ) : (
                      costsData.byCallPoint.map((r) => (
                        <MetricRow
                          key={r.callPoint ?? "unknown"}
                          label={r.callPoint ?? "unknown"}
                          value={`$${r.cost.toFixed(4)}`}
                          valueClass="text-warning"
                        />
                      ))
                    )}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <SectionLabel>By trigger</SectionLabel>
                  <div className="mt-2 space-y-0.5">
                    {costsData.byTrigger.length === 0 ? (
                      <p className="py-1 text-[10px] text-muted">No data yet</p>
                    ) : (
                      costsData.byTrigger.map((r) => (
                        <MetricRow
                          key={r.trigger ?? "unknown"}
                          label={r.trigger ?? "unknown"}
                          value={`$${r.cost.toFixed(4)}`}
                          valueClass="text-warning"
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {costsData.recentScans.length > 0 && (
                <div className="border-t border-border-default">
                  <div className="border-b border-border-default px-4 py-2">
                    <SectionLabel>Per harvest (last 30d)</SectionLabel>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface-card">
                        <tr className="border-b border-border-default">
                          {["Date", "Scoring", "P&D", "Reports", "Total"].map(
                            (h, i) => (
                              <th
                                key={h}
                                className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted ${i === 0 ? "text-left" : "text-right"}`}
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default">
                        {costsData.recentScans.map((s) => (
                          <tr
                            key={s.scanId}
                            className="transition-colors duration-fast hover:bg-surface-subtle"
                          >
                            <td className="whitespace-nowrap px-4 py-1.5 font-mono tabular-nums text-muted">
                              {s.startedAt ? formatDate(s.startedAt) : "—"}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono tabular-nums text-label">
                              ${s.scoring.toFixed(4)}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono tabular-nums text-label">
                              ${s.pnd.toFixed(4)}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono tabular-nums text-label">
                              ${s.report.toFixed(4)}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono tabular-nums font-semibold text-warning">
                              ${s.total.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {costsData.onDemandByUser.length > 0 && (
                <div className="border-t border-border-default px-4 py-3">
                  <SectionLabel>On-demand by user (last 30d)</SectionLabel>
                  <div className="mt-2 space-y-0.5">
                    {costsData.onDemandByUser.map((u) => (
                      <div
                        key={u.userId ?? "anon"}
                        className="flex items-center justify-between py-[3px] text-xs"
                      >
                        <span className="max-w-[200px] truncate text-secondary">
                          {u.email}
                        </span>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-mono text-muted">{u.calls} rpts</span>
                          <span className="font-mono tabular-nums font-semibold text-warning">
                            ${u.cost.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ── X API Usage ── */}
          {xUsageData && (
            <Card>
              <CardHead>X / Twitter API Usage</CardHead>
              <div className="grid grid-cols-2 divide-border-default border-b border-border-default sm:grid-cols-4 sm:divide-x">
                {[
                  { label: "All time", ...xUsageData.totals.allTime },
                  { label: "Last 30d", ...xUsageData.totals.last30d },
                  { label: "Last 7d", ...xUsageData.totals.last7d },
                  { label: "Last 24h", ...xUsageData.totals.last24h },
                ].map(({ label, calls }, i) => (
                  <div
                    key={label}
                    className={`px-3 py-3 ${i < 2 ? "border-b border-border-default sm:border-b-0" : ""}`}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                      {label}
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums text-info">
                      {calls}
                    </p>
                    <p className="text-[10px] text-muted">API calls</p>
                  </div>
                ))}
              </div>

              {xUsageData.errors7d > 0 && (
                <div className="border-b border-border-default px-4 py-2">
                  <p className="text-xs font-medium text-danger">
                    {xUsageData.errors7d} errors in last 7d
                  </p>
                </div>
              )}

              <div className="grid divide-x divide-border-default sm:grid-cols-2">
                <div className="px-4 py-3">
                  <SectionLabel>By action</SectionLabel>
                  <div className="mt-2 space-y-0.5">
                    {xUsageData.byAction.length === 0 ? (
                      <p className="py-1 text-[10px] text-muted">No data yet</p>
                    ) : (
                      xUsageData.byAction.map((r) => (
                        <MetricRow
                          key={r.action}
                          label={r.action}
                          value={r.calls}
                          valueClass="text-info"
                        />
                      ))
                    )}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <SectionLabel>By endpoint</SectionLabel>
                  <div className="mt-2 space-y-0.5">
                    {xUsageData.byEndpoint.length === 0 ? (
                      <p className="py-1 text-[10px] text-muted">No data yet</p>
                    ) : (
                      xUsageData.byEndpoint.map((r) => (
                        <MetricRow
                          key={r.endpoint}
                          label={r.endpoint}
                          value={r.calls}
                          valueClass="text-info"
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {xUsageData.recentLogs.length > 0 && (
                <div className="border-t border-border-default">
                  <div className="border-b border-border-default px-4 py-2">
                    <SectionLabel>Recent API calls</SectionLabel>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface-card">
                        <tr className="border-b border-border-default">
                          {["Time", "Action", "Endpoint", "Calls", "Status"].map(
                            (h, i) => (
                              <th
                                key={h}
                                className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted ${i >= 3 ? "text-right" : "text-left"}`}
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default">
                        {xUsageData.recentLogs.map((l) => (
                          <tr
                            key={l.id}
                            className="transition-colors duration-fast hover:bg-surface-subtle"
                          >
                            <td className="whitespace-nowrap px-4 py-1.5 font-mono tabular-nums text-muted">
                              {formatRelative(l.createdAt)}
                            </td>
                            <td className="px-4 py-1.5 font-medium text-label">
                              {l.action}
                            </td>
                            <td className="px-4 py-1.5 text-muted">
                              {l.method} {l.endpoint}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono tabular-nums text-label">
                              {l.count}
                            </td>
                            <td
                              className={`px-4 py-1.5 text-right font-mono tabular-nums font-medium ${l.statusCode && l.statusCode >= 400 ? "text-danger" : "text-success"}`}
                            >
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
        </>
      )}

      {/* ── Users table ── */}
      <UsersTable users={usersData?.users} loading={usersLoading} />
    </div>
  );
}

function getNow() {
  return Date.now();
}

function UsersTable({
  users,
  loading,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: any[] | undefined;
  loading: boolean;
}) {
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
        (u) =>
          u.subscription &&
          (u.subscription.status === "ACTIVE" ||
            u.subscription.status === "PAST_DUE")
      );
    } else if (filterPlan === "free") {
      list = list.filter(
        (u) =>
          !u.subscription ||
          (u.subscription.status !== "ACTIVE" &&
            u.subscription.status !== "PAST_DUE")
      );
    }
    return list;
  }, [users, search, filterPlan]);

  const now = getNow();

  const activeCount =
    users?.filter((u) => {
      if (!u.lastActiveAt) return false;
      return now - new Date(u.lastActiveAt).getTime() < 7 * 86_400_000;
    }).length ?? 0;

  return (
    <Card>
      <div className="flex flex-col gap-2 border-b border-border-default px-4 py-2.5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <SectionLabel>Registered Users</SectionLabel>
          {users && (
            <span className="font-mono text-[10px] text-muted">
              {users.length} total · {activeCount} active 7d
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <select
            value={filterPlan}
            onChange={(e) =>
              setFilterPlan(e.target.value as "all" | "pro" | "free")
            }
            className="rounded-sm border border-border-input bg-surface-input px-2 py-1 text-xs text-label focus:outline-none focus:ring-1 focus:ring-info/50"
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
            className="w-44 min-w-0 rounded-sm border border-border-input bg-surface-input px-2 py-1 text-xs text-label placeholder-muted focus:outline-none focus:ring-1 focus:ring-info/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="text-info" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="max-h-[520px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-surface-card">
              <tr className="border-b border-border-default">
                <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-muted">
                  Email
                </th>
                <th className="hidden px-4 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-muted sm:table-cell">
                  Username
                </th>
                <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-muted">
                  Joined
                </th>
                <th className="px-4 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-muted">
                  Plan
                </th>
                <th className="hidden px-4 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-muted md:table-cell">
                  Pos
                </th>
                <th className="hidden px-4 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-muted md:table-cell">
                  Watch
                </th>
                <th className="hidden px-4 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-muted md:table-cell">
                  Alerts
                </th>
                <th className="hidden px-4 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-muted md:table-cell">
                  API
                </th>
                <th className="px-4 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-muted">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {filtered.map((u) => {
                const active24h =
                  u.lastActiveAt &&
                  now - new Date(u.lastActiveAt).getTime() < 86_400_000;
                const active7d =
                  u.lastActiveAt &&
                  now - new Date(u.lastActiveAt).getTime() < 7 * 86_400_000;
                const isPro =
                  u.subscription &&
                  (u.subscription.status === "ACTIVE" ||
                    u.subscription.status === "PAST_DUE");
                const isCanceling = isPro && u.subscription.cancelAtPeriodEnd;
                const isPastDue =
                  isPro && u.subscription.status === "PAST_DUE";
                return (
                  <tr
                    key={u.id}
                    className="transition-colors duration-fast hover:bg-surface-subtle"
                  >
                    <td className="max-w-[160px] truncate px-4 py-1.5 text-label">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${active24h ? "bg-success" : active7d ? "bg-warning" : "bg-border-strong"}`}
                        />
                        <span className="truncate">{u.email}</span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-1.5 text-secondary sm:table-cell">
                      {u.username ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-1.5 font-mono tabular-nums text-muted">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-1.5 text-center">
                      {isPro ? (
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isCanceling
                              ? "bg-warning/10 text-warning"
                              : isPastDue
                                ? "bg-danger/10 text-danger"
                                : "bg-success/10 text-success"
                          }`}
                        >
                          {isCanceling
                            ? "Canceling"
                            : isPastDue
                              ? "Past Due"
                              : "Pro"}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-1.5 text-right font-mono tabular-nums text-label md:table-cell">
                      {u._count.positions}
                    </td>
                    <td className="hidden px-4 py-1.5 text-right font-mono tabular-nums text-label md:table-cell">
                      {u._count.watchlist}
                    </td>
                    <td className="hidden px-4 py-1.5 text-center md:table-cell">
                      <span
                        className={`text-[9px] font-bold uppercase ${u.emailAlerts ? "text-success" : "text-muted"}`}
                      >
                        {u.emailAlerts ? "On" : "—"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-1.5 text-center md:table-cell">
                      <span
                        className={`text-[9px] font-bold uppercase ${u._count.apiKeys > 0 ? "text-success" : "text-muted"}`}
                      >
                        {u._count.apiKeys > 0 ? "Yes" : "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums text-muted">
                      {u.lastActiveAt ? formatRelative(u.lastActiveAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-xs text-muted">
          {search || filterPlan !== "all"
            ? "No users match your filters."
            : "No users found."}
        </p>
      )}
    </Card>
  );
}
