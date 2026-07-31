import { NextRequest, NextResponse } from "next/server";
import { investigateIncident } from "../../../agent";
import { detectedAnomalies } from "../../../data";
import { buildWorkflow } from "../../../workflow";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incident = detectedAnomalies.find((item) => item.id === id);
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  if (incident.id === "INC-2407") {
    return NextResponse.json({
      incident: {
        id: incident.id,
        title: incident.title,
        market: incident.market,
        device: incident.device,
        metric: incident.metric,
        delta: incident.delta,
        detector: incident.detector,
        estimatedImpact: incident.estimatedImpact,
      },
      status: "ready_to_run",
      trace: [],
      conclusion: null,
      run: "POST /api/investigations/INC-2407/run",
    });
  }

  return NextResponse.json({
    incident,
    status: incident.status === "Resolved" ? "completed" : "awaiting_approval",
    toolResults: investigateIncident(incident),
    workflow: buildWorkflow(incident, incident.status === "Resolved"),
  });
}
