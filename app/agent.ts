import { adMetrics, type DetectedAnomaly } from "./data";

export type ToolResult = {
  tool: string;
  purpose: string;
  result: string;
  source: string;
  status: "success";
};

const runbooks = {
  CTR: {
    id: "RB-014",
    title: "CTR decline investigation",
    guidance: "Check market and device concentration, creative fatigue, page latency, and recent releases.",
  },
  Spend: {
    id: "RB-021",
    title: "Spend spike investigation",
    guidance: "Compare bid, budget and targeting changes before assuming traffic quality shifted.",
  },
  Revenue: {
    id: "RB-008",
    title: "Revenue decline investigation",
    guidance: "Separate traffic loss from conversion loss and verify tracking integrity.",
  },
};

const changeLog = [
  { market: "US", device: "Mobile", change: "Release v3.18.4 deployed", detail: "Landing-page rendering bundle updated" },
  { market: "DE", device: "Desktop", change: "Bid multiplier 1.0 → 1.3", detail: "Manual configuration change" },
  { market: "UK", device: "Mobile", change: "Conversion tag configuration updated", detail: "Tag event name changed" },
];

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
  const runbook = runbooks[incident.metric];

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
      result: `${runbook.id} · ${runbook.title}: ${runbook.guidance}`,
      source: runbook.id,
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
