import { NextResponse } from "next/server";
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
  return NextResponse.json({
    description: methodologyDescription,
    pipelineSteps: [...pipelineSteps],
    signalSources,
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
  });
}
