import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
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

test("anomaly detector matches all ground-truth cases", async () => {
  const response = await request("/api/anomalies");
  const body = await response.json();
  assert.equal(body.anomalies.length, 3);
  assert.equal(body.evaluation.precision, 1);
  assert.equal(body.evaluation.recall, 1);
  assert.equal(body.evaluation.falsePositives, 0);
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
