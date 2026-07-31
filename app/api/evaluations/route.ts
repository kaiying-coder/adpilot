import { NextResponse } from "next/server";
import { detectedAnomalies, replaySummary } from "../../data";

export async function GET() {
  const replay = replaySummary(detectedAnomalies);
  return NextResponse.json({
    dataset: "adpilot-14-day-replay-v2",
    detector: replay,
    caveat: replay.evaluationLimit,
    retrieval: {
      corpusSize: 6,
      testQueries: 3,
      citationChecksPassed: "3/3",
    },
    agent: {
      liveLlmScope: "INC-2407",
      model: "@cf/meta/llama-3.1-8b-instruct-fast",
      requiredTools: ["query_metrics", "search_runbook", "get_similar_incidents"],
      approvalGuardrail: "required",
      paidApiKeyRequired: false,
      workersAiFreeAllocation: "10,000 neurons/day",
    },
  });
}
