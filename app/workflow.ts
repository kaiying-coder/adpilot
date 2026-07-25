import { investigateIncident, type ToolResult } from "./agent";
import type { DetectedAnomaly } from "./data";

export type WorkflowState =
  | "detected"
  | "planning"
  | "querying"
  | "retrieving"
  | "verifying"
  | "awaiting_approval"
  | "executing"
  | "monitoring"
  | "completed";

export type WorkflowStep = {
  state: WorkflowState;
  title: string;
  status: "completed" | "active" | "pending";
  detail: string;
  tool?: ToolResult["tool"];
};

export function buildWorkflow(incident: DetectedAnomaly, approved = false): WorkflowStep[] {
  const tools = investigateIncident(incident);
  const tool = (name: ToolResult["tool"]) => tools.find((item) => item.tool === name);
  const afterApproval = approved || incident.status === "Resolved";

  return [
    { state: "detected", title: "Anomaly detected", status: "completed", detail: `${incident.metric} changed ${incident.delta}% from baseline.` },
    { state: "planning", title: "Investigation planned", status: "completed", detail: "Plan constrained to approved read-only tools." },
    { state: "querying", title: "Metrics and dimensions queried", status: "completed", detail: tool("query_metrics")?.result ?? "", tool: "query_metrics" },
    { state: "retrieving", title: "Knowledge retrieved", status: "completed", detail: tool("retrieve_runbook")?.result ?? "", tool: "retrieve_runbook" },
    { state: "verifying", title: "Root-cause hypothesis verified", status: "completed", detail: incident.evidence, tool: "verify_hypothesis" },
    { state: "awaiting_approval", title: "Human approval", status: afterApproval ? "completed" : "active", detail: incident.action },
    { state: "executing", title: "Simulated action executed", status: afterApproval ? "completed" : "pending", detail: "No external advertising system is modified." },
    { state: "monitoring", title: "Recovery monitored", status: afterApproval ? "active" : "pending", detail: "Compare the next 20-minute window with the pre-action baseline." },
    { state: "completed", title: "Incident closed", status: incident.status === "Resolved" ? "completed" : "pending", detail: "Close only after the target metric recovers." },
  ];
}
