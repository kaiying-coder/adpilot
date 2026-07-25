import { NextResponse } from "next/server";
import { detectedAnomalies, evaluateDetector } from "../../data";

export async function GET() {
  return NextResponse.json({
    anomalies: detectedAnomalies,
    evaluation: evaluateDetector(detectedAnomalies),
    detector: {
      version: "baseline-rules-v1",
      methods: ["historical baseline", "relative delta", "leading-indicator deduplication"],
    },
  });
}
