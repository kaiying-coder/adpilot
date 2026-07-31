import { adMetrics, anomalyGroundTruth, analyzeCtrShift, type DetectedAnomaly, type Device, type Market } from "./data";
import { searchKnowledge } from "./knowledge";

export type ToolResult = {
  tool: string;
  purpose: string;
  result: string;
  source: string;
  status: "success";
};

const changeLog = [
  { market: "US", device: "Mobile", change: "Release v3.18.4 deployed", detail: "Landing-page rendering bundle updated" },
  { market: "DE", device: "Desktop", change: "Bid multiplier 1.0 → 1.3", detail: "Manual configuration change" },
  { market: "UK", device: "Mobile", change: "Conversion tag configuration updated", detail: "Tag event name changed" },
];

export type AgentToolName = "query_metrics" | "search_runbook" | "get_similar_incidents";

export type AgentToolRequest = {
  tool: AgentToolName;
  args?: {
    market?: Market;
    device?: Device;
    window?: number;
    query?: string;
  };
  rationale?: string;
};

export type LiveAgentTrace = {
  step: number;
  decision: string;
  request: AgentToolRequest;
  observation: ToolResult;
};

export function executeAgentTool(
  request: AgentToolRequest,
  incident: DetectedAnomaly
): ToolResult {
  if (request.tool === "query_metrics") {
    const market = request.args?.market ?? incident.market;
    const device = request.args?.device ?? incident.device;
    const window = Math.min(Math.max(request.args?.window ?? 14, 7), 14);
    const scoped = adMetrics
      .filter((row) => row.market === market && row.device === device)
      .slice(-window);
    const shift = analyzeCtrShift(scoped);
    const historical = scoped.slice(0, -3);
    const recent = scoped.slice(-3);
    const historicalRevenue = historical.length
      ? historical.reduce((sum, row) => sum + row.revenue, 0) / historical.length
      : 0;
    const recentRevenue = recent.length
      ? recent.reduce((sum, row) => sum + row.revenue, 0) / recent.length
      : 0;
    return {
      tool: request.tool,
      purpose: request.rationale ?? "Measure the affected segment with live tool output",
      result:
        `${market} × ${device}, ${window}-day window: CTR ${(shift.baseline * 100).toFixed(2)}% → ` +
        `${(shift.current * 100).toFixed(2)}% (${shift.zScore.toFixed(1)}σ); latency ` +
        `+${Math.round(shift.latencyDeltaMs)}ms; daily revenue $${Math.round(historicalRevenue).toLocaleString()} → ` +
        `$${Math.round(recentRevenue).toLocaleString()}.`,
      source: `campaign_metrics:${market}:${device}:${window}d`,
      status: "success",
    };
  }

  if (request.tool === "search_runbook") {
    const query = request.args?.query ?? `${incident.metric} anomaly ${incident.market} ${incident.device}`;
    const hits = searchKnowledge(query, 3);
    return {
      tool: request.tool,
      purpose: request.rationale ?? "Ground the next step in approved operational knowledge",
      result: hits.map((hit) => `${hit.citation}: ${hit.excerpt}`).join(" "),
      source: hits.map((hit) => hit.citation).join(", "),
      status: "success",
    };
  }

  const similar = anomalyGroundTruth
    .filter((item) => item.id !== incident.id && (
      item.metric === incident.metric || item.device === incident.device
    ))
    .slice(0, 2);
  const historicalCase = searchKnowledge(
    `${incident.metric} ${incident.device} historical incident`,
    1
  )[0];
  return {
    tool: request.tool,
    purpose: request.rationale ?? "Compare with prior incidents before proposing a high-risk action",
    result: [
      historicalCase ? `${historicalCase.citation}: ${historicalCase.excerpt}` : "",
      ...similar.map((item) => `${item.id}: ${item.cause}; action: ${item.action}.`),
    ].filter(Boolean).join(" "),
    source: [historicalCase?.citation, ...similar.map((item) => item.id)].filter(Boolean).join(", "),
    status: "success",
  };
}

export function investigateIncident(incident: DetectedAnomaly): ToolResult[] {
  const scoped = adMetrics.filter(
    (row) => row.market === incident.market && row.device === incident.device
  );
  const recent = scoped.slice(-3);
  const totalRevenue = recent.reduce((sum, row) => sum + row.revenue, 0);
  const avgLatency = Math.round(recent.reduce((sum, row) => sum + row.latencyMs, 0) / recent.length);
  const change = changeLog.find(
    (item) => item.market === incident.market && item.device === incident.device
  );
  const knowledge = searchKnowledge(`${incident.metric} ${incident.market} ${incident.device} ${incident.cause}`, 2);

  return [
    {
      tool: "query_metrics",
      purpose: "Measure the affected segment",
      result: `${recent.length}-day revenue $${totalRevenue.toLocaleString()} · average latency ${avgLatency}ms`,
      source: "campaign_metrics",
      status: "success",
    },
    {
      tool: "slice_dimensions",
      purpose: "Locate the concentration of impact",
      result: `${incident.market} × ${incident.device} is the leading affected segment`,
      source: "campaign_metrics",
      status: "success",
    },
    {
      tool: "retrieve_runbook",
      purpose: "Ground the investigation plan",
      result: knowledge.map((hit) => `${hit.citation}: ${hit.excerpt}`).join(" "),
      source: knowledge.map((hit) => hit.citation).join(", "),
      status: "success",
    },
    {
      tool: "query_change_log",
      purpose: "Correlate the anomaly with recent changes",
      result: change ? `${change.change} · ${change.detail}` : "No relevant change found",
      source: "change_log",
      status: "success",
    },
    {
      tool: "verify_hypothesis",
      purpose: "Test the strongest causal hypothesis",
      result: incident.evidence,
      source: "analysis_engine",
      status: "success",
    },
  ];
}
