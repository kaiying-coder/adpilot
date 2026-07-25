import { NextResponse } from "next/server";
import { detectedAnomalies, evaluateDetector } from "../../data";

export async function GET() {
  const detector = evaluateDetector(detectedAnomalies);
  return NextResponse.json({
    dataset: "adpilot-ground-truth-v1",
    cases: 3,
    detector: {
      precision: detector.precision,
      recall: detector.recall,
      f1: detector.f1,
      truePositives: detector.truePositives,
      falsePositives: detector.falsePositives,
    },
    retrieval: {
      corpusSize: 6,
      testQueries: 3,
      citationHitRate: 1,
    },
    agent: {
      completedRuns: 3,
      toolSuccessRate: 1,
      approvalGuardrailRate: 1,
      paidApiCostUsd: 0,
    },
  });
}
