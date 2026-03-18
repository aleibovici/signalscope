import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

const VALID_DAYS = new Set([1, 3, 7, 30]);
const HORIZONS = [1, 3, 7, 30] as const;
type ReturnCol = "return1d" | "return3d" | "return7d" | "return30d";
type PriceCol = "price1d" | "price3d" | "price7d" | "price30d";

interface PerformanceRecord {
  symbol: string;
  detectionPrice: number;
  return1d: number | null;
  return3d: number | null;
  return7d: number | null;
  return30d: number | null;
  price1d: number | null;
  price3d: number | null;
  price7d: number | null;
  price30d: number | null;
  createdAt: Date;
  validatedTicker: {
    aiScore: number;
    opportunityScore: number;
    stage: string;
    signalType: string | null;
    createdAt: Date;
  };
}

function computeStats(records: PerformanceRecord[], col: ReturnCol) {
  const returns = records
    .map((r) => r[col])
    .filter((v): v is number => v !== null);
  const count = returns.length;
  if (count === 0) return { count: 0, winRate: 0, avgReturn: 0 };
  const wins = returns.filter((r) => r > 0).length;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / count;
  return { count, winRate: wins / count, avgReturn };
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(mondayStr: string): string {
  const d = new Date(mondayStr + "T00:00:00Z");
  const sun = new Date(d);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(d)}–${fmt(sun)}`;
}

export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
    const daysParam = request.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 7;

    if (!Number.isInteger(days) || !VALID_DAYS.has(days)) {
      return NextResponse.json(
        { error: "Invalid days parameter. Valid values: 1, 3, 7, 30" },
        { status: 400 },
      );
    }

    const returnCol = `return${days}d` as ReturnCol;
    const priceCol = `price${days}d` as PriceCol;

    // Fetch all performance records (deduped by symbol, earliest detection)
    const records: PerformanceRecord[] = await prisma.tickerPerformance.findMany(
      {
        where: {
          detectionPrice: { gt: 0.01 },
          validatedTicker: {
            stage: { notIn: ["FILTERED", "UNSCORED"] },
          },
        },
        distinct: ["symbol"],
        include: {
          validatedTicker: {
            select: {
              aiScore: true,
              opportunityScore: true,
              stage: true,
              signalType: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    );

    if (records.length === 0) {
      return NextResponse.json({
        summary: {
          totalTracked: 0,
          current: { count: 0, winRate: 0, avgReturn: 0 },
          prior: { count: 0, winRate: 0, avgReturn: 0 },
        },
        cohorts: [],
        cumulativeReturns: [],
        overall: { count: 0, winRate: 0, avgReturn: 0 },
        confirmed: { count: 0, winRate: 0, avgReturn: 0 },
        early: { count: 0, winRate: 0, avgReturn: 0 },
        byStage: {},
        byType: {},
        byScoreRange: {},
        byOpportunityScoreRange: {},
        bestPerformers: [],
        worstPerformers: [],
      });
    }

    // --- Summary: current 30d vs prior 30d ---
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const currentRecords = records.filter(
      (r) => r.validatedTicker.createdAt >= thirtyDaysAgo && r.validatedTicker.stage === "EARLY",
    );
    const priorRecords = records.filter(
      (r) =>
        r.validatedTicker.createdAt >= sixtyDaysAgo &&
        r.validatedTicker.createdAt < thirtyDaysAgo &&
        r.validatedTicker.stage === "EARLY",
    );

    const summary = {
      totalTracked: records.length,
      current: computeStats(currentRecords, returnCol),
      prior: computeStats(priorRecords, returnCol),
    };

    // --- Weekly cohorts ---
    const cohortMap = new Map<
      string,
      PerformanceRecord[]
    >();
    for (const r of records) {
      const week = getMonday(r.validatedTicker.createdAt);
      if (!cohortMap.has(week)) cohortMap.set(week, []);
      cohortMap.get(week)!.push(r);
    }

    const cohorts = [...cohortMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .slice(0, 12)
      .map(([weekStart, group]) => {
        const stats: Record<string, { count: number; winRate: number; avgReturn: number }> = {};
        for (const h of HORIZONS) {
          const col: ReturnCol = `return${h}d`;
          const s = computeStats(group, col);
          if (s.count > 0) {
            stats[`${h}d`] = s;
          }
        }

        // Best pick for this cohort (use longest available horizon)
        let bestPick: { symbol: string; returnPct: number; horizon: string } | null = null;
        for (const h of ([7, 3, 1] as const)) {
          const col: ReturnCol = `return${h}d`;
          const withReturn = group.filter((r) => r[col] !== null);
          if (withReturn.length > 0) {
            const best = withReturn.reduce((a, b) =>
              (a[col] as number) > (b[col] as number) ? a : b,
            );
            bestPick = {
              symbol: best.symbol,
              returnPct: best[col] as number,
              horizon: `${h}d`,
            };
            break;
          }
        }

        return {
          weekStart,
          weekLabel: formatWeekLabel(weekStart),
          count: group.length,
          stats,
          bestPick,
        };
      });

    // --- Cumulative equal-weight returns — emerging signals only ---
    const withReturn = records
      .filter((r) => r[returnCol] !== null && r.validatedTicker.stage === "EARLY")
      .sort(
        (a, b) =>
          a.validatedTicker.createdAt.getTime() -
          b.validatedTicker.createdAt.getTime(),
      );

    const cumulativeReturns: Array<{
      date: string;
      cumReturn: number;
      tradeCount: number;
    }> = [];
    let runningSum = 0;
    for (let i = 0; i < withReturn.length; i++) {
      const r = withReturn[i];
      runningSum += r[returnCol] as number;
      const avgCum = runningSum / (i + 1);
      cumulativeReturns.push({
        date: r.validatedTicker.createdAt.toISOString().slice(0, 10),
        cumReturn: avgCum,
        tradeCount: i + 1,
      });
    }

    // --- Breakdowns (same as before, for selected horizon) ---
    const recordsWithReturn = records.filter((r) => r[returnCol] !== null);
    const overall = computeStats(recordsWithReturn, returnCol);
    const confirmedRecords = recordsWithReturn.filter(
      (r) => r.validatedTicker.stage === "CONFIRMED",
    );
    const confirmed = computeStats(confirmedRecords, returnCol);
    const earlyRecords = recordsWithReturn.filter(
      (r) => r.validatedTicker.stage === "EARLY",
    );
    const early = computeStats(earlyRecords, returnCol);

    // By stage
    const byStage: Record<string, ReturnType<typeof computeStats>> = {};
    const stageGroups = new Map<string, PerformanceRecord[]>();
    for (const r of recordsWithReturn) {
      const stage = r.validatedTicker.stage;
      if (!stageGroups.has(stage)) stageGroups.set(stage, []);
      stageGroups.get(stage)!.push(r);
    }
    for (const s of ["EARLY", "FORMING", "CONFIRMED"] as const) {
      const group = stageGroups.get(s);
      if (group) byStage[s] = computeStats(group, returnCol);
    }

    // By signal type
    const byType: Record<string, ReturnType<typeof computeStats>> = {};
    const typeGroups = new Map<string, PerformanceRecord[]>();
    for (const r of recordsWithReturn) {
      const type = r.validatedTicker.signalType ?? "unknown";
      if (!typeGroups.has(type)) typeGroups.set(type, []);
      typeGroups.get(type)!.push(r);
    }
    for (const [type, group] of typeGroups) {
      byType[type] = computeStats(group, returnCol);
    }

    // By score range
    const byScoreRange: Record<string, ReturnType<typeof computeStats>> = {};
    const ranges = [
      { label: "0-30", min: 0, max: 30 },
      { label: "30-50", min: 30, max: 50 },
      { label: "50-70", min: 50, max: 70 },
      { label: "70-100", min: 70, max: 101 },
    ];
    const rangeGroups = new Map<string, PerformanceRecord[]>();
    for (const r of recordsWithReturn) {
      const score = r.validatedTicker.aiScore;
      for (const range of ranges) {
        if (score >= range.min && score < range.max) {
          if (!rangeGroups.has(range.label)) rangeGroups.set(range.label, []);
          rangeGroups.get(range.label)!.push(r);
          break;
        }
      }
    }
    for (const range of ranges) {
      const group = rangeGroups.get(range.label);
      if (group) byScoreRange[range.label] = computeStats(group, returnCol);
    }

    // By opportunity score range
    const byOpportunityScoreRange: Record<string, ReturnType<typeof computeStats>> = {};
    const oppRanges = [
      { label: "0-25", min: 0, max: 25 },
      { label: "25-50", min: 25, max: 50 },
      { label: "50-75", min: 50, max: 75 },
      { label: "75-100", min: 75, max: 101 },
    ];
    const oppRangeGroups = new Map<string, PerformanceRecord[]>();
    for (const r of recordsWithReturn) {
      const oppScore = r.validatedTicker.opportunityScore;
      for (const range of oppRanges) {
        if (oppScore >= range.min && oppScore < range.max) {
          if (!oppRangeGroups.has(range.label)) oppRangeGroups.set(range.label, []);
          oppRangeGroups.get(range.label)!.push(r);
          break;
        }
      }
    }
    for (const range of oppRanges) {
      const group = oppRangeGroups.get(range.label);
      if (group) byOpportunityScoreRange[range.label] = computeStats(group, returnCol);
    }

    // Best/Worst performers — emerging signals only
    const sorted = [...recordsWithReturn]
      .filter((r) => r.validatedTicker.stage === "EARLY")
      .sort((a, b) => (b[returnCol] as number) - (a[returnCol] as number));

    const mapPerformer = (r: PerformanceRecord) => ({
      symbol: r.symbol,
      return: r[returnCol] as number,
      aiScore: r.validatedTicker.aiScore,
      stage: r.validatedTicker.stage,
      detectionPrice: r.detectionPrice,
      currentPrice: r[priceCol] as number,
      detectedAt: r.validatedTicker.createdAt.toISOString().slice(0, 10),
    });

    const bestPerformers = sorted.slice(0, 5).map(mapPerformer);
    const worstPerformers = sorted.slice(-5).reverse().map(mapPerformer);

    return NextResponse.json({
      summary,
      cohorts,
      cumulativeReturns,
      overall,
      confirmed,
      early,
      byStage,
      byType,
      byScoreRange,
      byOpportunityScoreRange,
      bestPerformers,
      worstPerformers,
    });
  } catch (err) {
    return handleApiError(err, "performance");
  }
}
