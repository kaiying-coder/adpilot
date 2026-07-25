import { NextRequest, NextResponse } from "next/server";
import { investigateIncident } from "../../../agent";
import { detectedAnomalies } from "../../../data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incident = detectedAnomalies.find((item) => item.id === id);
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  return NextResponse.json({
    incident,
    status: incident.status === "Resolved" ? "completed" : "awaiting_approval",
    toolResults: investigateIncident(incident),
  });
}
