import { NextResponse } from "next/server";
import { detectedAnomalies, replaySummary } from "../../data";

export async function GET() {
  return NextResponse.json({
    anomalies: detectedAnomalies,
    replay: replaySummary(detectedAnomalies),
    detector: {
      version: "replay-detector-v2",
      methods: ["z-score with operational variance floor", "changepoint", "relative delta", "leading-indicator deduplication"],
    },
  });
}
