import { NextRequest, NextResponse } from "next/server";
import { adMetrics, dailyRevenue, summarize, type Device, type Market } from "../../data";

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") as Market | "All" | null;
  const device = request.nextUrl.searchParams.get("device") as Device | "All" | null;
  const rows = adMetrics.filter(
    (row) =>
      (!market || market === "All" || row.market === market) &&
      (!device || device === "All" || row.device === device)
  );

  return NextResponse.json({
    filters: { market: market ?? "All", device: device ?? "All" },
    summary: summarize(rows),
    trend: dailyRevenue(rows),
    rowCount: rows.length,
    source: "adpilot-simulated-v1",
  });
}
