import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
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

export async function GET() {
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
      disclaimer,
    }, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/methodology");
  }
}
