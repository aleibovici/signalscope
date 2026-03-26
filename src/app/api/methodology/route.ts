import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getClientIP, isRateLimited } from "@/lib/rate-limit";
import {
  pipelineSteps,
  signalSources,
  sourceWeights,
  scoringBands,
  pndFlags,
  signalStages,
  recommendationLevels,
  methodologyDescription,
  aggregationDescription,
  scoringDescription,
  pndDescription,
  backtestDescription,
  backtestPipeline,
  disclaimer,
} from "@/lib/methodology-data";
import {
  scoreExplainerMethodologyTitle,
  scoreExplainerMethodologyBody,
  scoreExplainerDashboardCallout,
  scoreExplainerTrendingCallout,
  scoreExplainerPerformanceInsight,
} from "@/lib/score-explainer";

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (isRateLimited(`methodology:${ip}`, 60_000, 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const activeSignalSources = signalSources.map((source) => ({
      ...source,
      status: "active" as const,
    }));

    return NextResponse.json({
      description: methodologyDescription,
      pipelineSteps: [...pipelineSteps],
      signalSources: activeSignalSources,
      aggregation: {
        description: aggregationDescription,
        sourceWeights,
      },
      scoring: {
        description: scoringDescription,
        bands: scoringBands,
      },
      pumpAndDumpDetection: {
        description: pndDescription,
        flags: pndFlags,
        threshold: 3,
      },
      signalStages,
      recommendationLevels,
      backtesting: {
        description: backtestDescription,
        pipeline: [...backtestPipeline],
      },
      scoreComparison: {
        title: scoreExplainerMethodologyTitle,
        detail: scoreExplainerMethodologyBody,
        dashboardCallout: scoreExplainerDashboardCallout,
        trendingCallout: scoreExplainerTrendingCallout,
        performanceInsight: scoreExplainerPerformanceInsight,
      },
      disclaimer,
    }, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/methodology");
  }
}
