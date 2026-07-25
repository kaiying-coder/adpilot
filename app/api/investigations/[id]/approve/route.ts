import { NextRequest, NextResponse } from "next/server";
import { detectedAnomalies } from "../../../../data";
import { buildWorkflow } from "../../../../workflow";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incident = detectedAnomalies.find((item) => item.id === id);
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (body.decision !== "approve") {
    return NextResponse.json({ error: "Only an explicit approve decision is accepted" }, { status: 400 });
  }

  const audit = {
    id: `APR-${incident.id}`,
    incidentId: incident.id,
    decision: "approved",
    actor: "demo-user",
    action: incident.action,
    execution: "simulated",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({
    audit,
    workflow: buildWorkflow(incident, true),
    message: "Simulated action approved; no external system was modified.",
  });
}
