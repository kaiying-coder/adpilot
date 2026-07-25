import { NextRequest, NextResponse } from "next/server";

const documents = [
  { id: "RB-014", type: "Runbook", title: "CTR下降排查手册 / CTR decline runbook", tags: ["CTR", "latency", "creative"], status: "Approved" },
  { id: "RB-021", type: "Runbook", title: "花费异常排查手册 / Spend spike runbook", tags: ["spend", "bid", "budget"], status: "Approved" },
  { id: "RB-008", type: "Runbook", title: "收入下降排查手册 / Revenue decline runbook", tags: ["revenue", "tracking", "CVR"], status: "Approved" },
  { id: "INC-2319", type: "Case", title: "移动端落地页延迟案例 / Mobile latency case", tags: ["mobile", "release", "latency"], status: "Verified" },
];

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
  const results = query
    ? documents.filter((doc) => `${doc.title} ${doc.tags.join(" ")}`.toLowerCase().includes(query))
    : documents;
  return NextResponse.json({ documents: results, total: results.length });
}
