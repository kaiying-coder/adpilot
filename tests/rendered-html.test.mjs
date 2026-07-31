import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
let aiCall = 0;
const aiDecisions = [
  { type: "tool", tool: "query_metrics", args: { market: "US", device: "Mobile", window: 14 }, rationale: "Measure the affected segment." },
  { type: "tool", tool: "search_runbook", args: { query: "CTR latency release rollback" }, rationale: "Ground the investigation." },
  { type: "tool", tool: "get_similar_incidents", args: {}, rationale: "Compare prior incidents." },
  {
    type: "final",
    hypothesis: "The mobile release caused a latency regression and CTR decline.",
    evidence: ["Computed metric shift", "Approved runbook", "Similar incident"],
    recommendedAction: "Request approval to roll back v3.18.4.",
    confidence: 0.91,
    rationale: "Three independent observations support the same cause.",
  },
];
const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  AI: {
    run: async () => ({
      response: JSON.stringify(aiDecisions[Math.min(aiCall++, aiDecisions.length - 1)]),
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    }),
  },
};
const context = { waitUntil() {}, passThroughOnException() {} };

function request(path, init) {
  return worker.fetch(new Request(`http://localhost${path}`, init), env, context);
}

test("renders the AdPilot product shell", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /AdPilot/);
  assert.match(html, /商业化控制中心/);
  assert.match(html, /异常中心/);
  assert.match(html, /知识库/);
  assert.match(html, /评估中心/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("metrics API filters the simulated dataset", async () => {
  const response = await request("/api/metrics?market=US&device=Mobile");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.filters, { market: "US", device: "Mobile" });
  assert.equal(body.rowCount, 14);
  assert.ok(body.summary.revenue > 0);
  assert.equal(body.trend.length, 14);
});

test("anomaly detector reports an honest replay summary", async () => {
  const response = await request("/api/anomalies");
  const body = await response.json();
  assert.equal(body.anomalies.length, 3);
  assert.equal(body.replay.knownIncidentsFound, "3/3");
  assert.equal(body.replay.unaffectedSegmentsAlerted, 0);
  assert.match(body.replay.tradeoff, /threshold/i);
  assert.ok(Math.abs(body.anomalies[0].detector.zScore) > 3);
  assert.equal(Math.round(body.anomalies[0].detector.latencyDeltaMs), 920);
});

test("scanner detects a newly injected, non-preset segment", async () => {
  const response = await request("/api/anomalies/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ market: "DE", device: "Mobile", metric: "CTR", deltaPct: -30 }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.detected, true);
  assert.equal(body.anomaly.market, "DE");
  assert.equal(body.anomaly.device, "Mobile");
  assert.equal(body.anomaly.metric, "CTR");
});

test("INC-2407 runs a live Workers AI tool loop", async () => {
  aiCall = 0;
  const response = await request("/api/investigations/INC-2407/run", { method: "POST" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, "workers-ai-live");
  assert.equal(body.trace.length, 3);
  assert.deepEqual(body.trace.map((item) => item.request.tool), [
    "query_metrics",
    "search_runbook",
    "get_similar_incidents",
  ]);
  assert.equal(body.conclusion.confidence, 0.91);
  assert.match(body.guardrail, /approval/i);
});

test("knowledge API returns ranked citations", async () => {
  const response = await request("/api/knowledge?q=latency%20ctr");
  const body = await response.json();
  assert.ok(body.hits.length > 0);
  assert.match(body.hits[0].citation, /§1/);
  assert.ok(body.hits[0].score > 0);
});

test("approval API requires an explicit decision", async () => {
  const rejected = await request("/api/investigations/INC-2407/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "reject" }),
  });
  assert.equal(rejected.status, 400);

  const approved = await request("/api/investigations/INC-2407/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve" }),
  });
  assert.equal(approved.status, 200);
  const body = await approved.json();
  assert.equal(body.audit.execution, "simulated");
  assert.equal(body.audit.decision, "approved");
});
