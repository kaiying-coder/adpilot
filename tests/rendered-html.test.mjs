import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
let aiCall = 0;
const aiDecisions = [
  {
    plan: [
      { tool: "query_metrics", args: { market: "US", device: "Mobile", window: 14 }, rationale: "Measure the affected segment." },
      { tool: "query_change_log", args: { market: "US", device: "Mobile" }, rationale: "Correlate the deployment." },
      { tool: "search_runbook", args: { query: "CTR latency release rollback" }, rationale: "Ground the investigation." },
      { tool: "get_similar_incidents", args: {}, rationale: "Compare prior incidents." },
    ],
  },
  {
    hypothesis: "The mobile release caused a latency regression and CTR decline.",
    evidence: ["Computed metric shift", "Approved runbook", "Similar incident"],
    recommendedAction: "Request approval to roll back v3.18.4.",
    confidence: 0.91,
    rationale: "Four independent observations support the same cause.",
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

function requestWithEnv(path, init, requestEnv) {
  return worker.fetch(new Request(`http://localhost${path}`, init), requestEnv, context);
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
  assert.match(html, /运行前不存在 LLM 根因假设/);
  assert.match(html, /开始 30 秒演示/);
  assert.match(html, /推荐演示 · 约 30 秒/);
  assert.match(html, /广告数据与收入影响为模拟数据/);
  assert.match(html, /高风险商业化操作永不自动执行/);
  assert.match(html, /KPI、趋势和异常列表按筛选条件/);
  assert.match(html, /不是生产准确率声明/);
  assert.match(html, /不等于 100% 精确率、召回率或 F1/);
  assert.match(html, /WORKERS AI · LIVE/);
  assert.doesNotMatch(html, /Yilin/);
  assert.doesNotMatch(html, /CTR shifted 3\.7σ|latency rose 920ms/);
  assert.doesNotMatch(html, /Rollback release v3\.18\.4/);
  assert.doesNotMatch(html, /Live LLM decision \+ tool trace/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("live incident GET exposes detector state but no scripted conclusion", async () => {
  const response = await request("/api/investigations/INC-2407");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ready_to_run");
  assert.deepEqual(body.trace, []);
  assert.equal(body.conclusion, null);
  assert.equal(body.incident.cause, undefined);
  assert.equal(body.incident.action, undefined);
  assert.equal(body.incident.evidence, undefined);
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
  assert.equal(body.replay.sampleSize, 3);
  assert.match(body.replay.evaluationLimit, /not a production/i);
  assert.equal(body.replay.sensitivity.length, 3);
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
  assert.equal(body.trace.length, 4);
  assert.deepEqual(body.trace.map((item) => item.request.tool), [
    "query_metrics",
    "query_change_log",
    "search_runbook",
    "get_similar_incidents",
  ]);
  assert.equal(body.conclusion.confidence, 0.91);
  assert.match(body.guardrail, /approval/i);
});

test("public live runs reuse a short cache instead of spending AI quota repeatedly", async () => {
  aiCall = 0;
  const init = { method: "POST", headers: { "cf-connecting-ip": "203.0.113.9" } };
  const first = await request("/api/investigations/INC-2407/run", init);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).cache.hit, false);
  const callsAfterFirst = aiCall;
  const second = await request("/api/investigations/INC-2407/run", init);
  assert.equal(second.status, 200);
  assert.equal((await second.json()).cache.hit, true);
  assert.equal(aiCall, callsAfterFirst);
});

test("AI analyst answers from the deployed model with filters and sources", async () => {
  const analystEnv = {
    ...env,
    AI: {
      run: async () => ({
        response: "美国移动端 CTR 下降与延迟上升同时出现；当前证据支持继续核查版本变更。 [RB-014 §1]",
        usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
      }),
    },
  };
  const response = await requestWithEnv("/api/analyst/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "为什么 CTR 下降？", market: "US", device: "Mobile", language: "zh" }),
  }, analystEnv);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, "workers-ai-grounded");
  assert.deepEqual(body.filters, { market: "US", device: "Mobile" });
  assert.match(body.answer, /CTR/);
  assert.ok(body.sources.includes("campaign_metrics:14d"));
});

test("AI outage returns a safe, retryable error for graceful degradation", async () => {
  const failingEnv = {
    ...env,
    AI: {
      run: async () => {
        throw new Error("upstream socket and account details must stay private");
      },
    },
  };
  const response = await requestWithEnv(
    "/api/investigations/INC-2407/run",
    { method: "POST" },
    failingEnv,
  );
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.errorCode, "AI_UPSTREAM_ERROR");
  assert.equal(body.retryable, true);
  assert.doesNotMatch(JSON.stringify(body), /socket|account details/i);
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
