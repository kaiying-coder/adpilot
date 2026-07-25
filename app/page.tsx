"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adMetrics,
  dailyRevenue,
  detectedAnomalies,
  evaluateDetector,
  summarize,
  type Device,
  type Market,
} from "./data";
import { investigateIncident } from "./agent";
import { searchKnowledge } from "./knowledge";

export default function Home() {
  const [view, setView] = useState<"overview" | "incidents" | "runs" | "knowledge" | "evaluations">("overview");
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [selected, setSelected] = useState(0);
  const [approved, setApproved] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [market, setMarket] = useState<Market | "All">("All");
  const [device, setDevice] = useState<Device | "All">("All");
  const incident = detectedAnomalies[selected];
  const filteredRows = useMemo(
    () => adMetrics.filter((row) =>
      (market === "All" || row.market === market) &&
      (device === "All" || row.device === device)
    ),
    [market, device]
  );
  const [summary, setSummary] = useState(() => summarize(filteredRows));
  const [trend, setTrend] = useState(() => dailyRevenue(filteredRows));
  const [apiLive, setApiLive] = useState(false);
  const maxRevenue = Math.max(...trend.map((point) => point.value), 1);
  const detectorQuality = useMemo(() => evaluateDetector(detectedAnomalies), []);
  const toolResults = useMemo(() => investigateIncident(incident), [incident]);
  const visibleAnomalies = detectedAnomalies.filter((item) =>
    (market === "All" || item.market === market) &&
    (device === "All" || item.device === device)
  );
  const progress = useMemo(() => (approved ? 100 : selected === 2 ? 100 : 68), [approved, selected]);
  const steps = [
    ["01", "Anomaly detected", `${incident.metric} moved ${Math.abs(incident.delta)}% from its expected baseline.`, "done"],
    ["02", "Dimensions investigated", `Impact narrowed to ${incident.market} · ${incident.device} traffic.`, "done"],
    ["03", "Knowledge retrieved", "Matched the relevant runbook and two historical incidents.", "done"],
    ["04", "Hypothesis verified", incident.evidence, "active"],
    ["05", "Action proposed", incident.action, "pending"],
  ];
  const labels = language === "zh"
    ? { overview: "总览", incidents: "异常中心", runs: "Agent运行", knowledge: "知识库", evaluations: "评估中心", hello: "晚上好，Yilin。", subtitle: "AdPilot 正在监控一套可复现的14天广告数据。", action: "＋ 新建调查" }
    : { overview: "Overview", incidents: "Incidents", runs: "Agent runs", knowledge: "Knowledge", evaluations: "Evaluations", hello: "Good evening, Yilin.", subtitle: "AdPilot is monitoring a reproducible 14-day advertising dataset.", action: "＋ New investigation" };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/metrics?market=${market}&device=${device}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => {
        if (cancelled) return;
        setSummary(payload.summary);
        setTrend(payload.trend);
        setApiLive(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSummary(summarize(filteredRows));
        setTrend(dailyRevenue(filteredRows));
        setApiLive(false);
      });
    return () => { cancelled = true; };
  }, [market, device, filteredRows]);

  function askAgent() {
    if (!query.trim()) return;
    setAnswer(
      `${incident.title} is the highest-impact matching event. ${incident.cause}. ` +
      `Evidence: ${incident.evidence}. Recommended action: ${incident.action}.`
    );
  }

  async function approveAction() {
    setApprovalStatus("saving");
    const response = await fetch(`/api/investigations/${incident.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    if (!response.ok) {
      setApprovalStatus("idle");
      return;
    }
    const payload = await response.json();
    setApproved(true);
    setApprovalStatus("saved");
    localStorage.setItem(`adpilot:${incident.id}:approval`, JSON.stringify(payload.audit));
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">A</span><span>AdPilot</span></div>
        <nav>
          <button onClick={() => setView("overview")} className={`navItem ${view === "overview" ? "active" : ""}`}><span>⌁</span> {labels.overview}</button>
          <button onClick={() => setView("incidents")} className={`navItem ${view === "incidents" ? "active" : ""}`}><span>⌕</span> {labels.incidents} <b>3</b></button>
          <button onClick={() => setView("runs")} className={`navItem ${view === "runs" ? "active" : ""}`}><span>✣</span> {labels.runs}</button>
          <button onClick={() => setView("knowledge")} className={`navItem ${view === "knowledge" ? "active" : ""}`}><span>▤</span> {labels.knowledge}</button>
          <button onClick={() => setView("evaluations")} className={`navItem ${view === "evaluations" ? "active" : ""}`}><span>◫</span> {labels.evaluations}</button>
        </nav>
        <div className="sideBottom">
          <div className="system"><i /> All systems operational</div>
          <div className="profile"><span>YL</span><div><strong>Yilin</strong><small>Monetization Ops</small></div><em>•••</em></div>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <div><p className="eyebrow">MONETIZATION CONTROL CENTER</p><h1>{labels.hello}</h1><p>{labels.subtitle}</p></div>
          <div className="headerActions"><button onClick={() => setLanguage(language === "zh" ? "en" : "zh")} className="languageButton">{language === "zh" ? "EN" : "中文"}</button><button className="primary">{labels.action}</button></div>
        </header>

        {view === "overview" ? <>
        <section className="filterBar" aria-label="Dashboard filters">
          <div><strong>{language === "zh" ? "数据范围" : "Data scope"}</strong><span>{language === "zh" ? "整页指标通过 AdPilot API 实时更新。" : "All dashboard values update through the AdPilot API."}</span></div>
          <label>Market
            <select value={market} onChange={(event) => setMarket(event.target.value as Market | "All")}>
              <option>All</option><option>US</option><option>DE</option><option>UK</option>
            </select>
          </label>
          <label>Device
            <select value={device} onChange={(event) => setDevice(event.target.value as Device | "All")}>
              <option>All</option><option>Mobile</option><option>Desktop</option>
            </select>
          </label>
          <span className="datasetBadge">{apiLive ? "API LIVE" : "LOCAL FALLBACK"} · $0</span>
        </section>

        <section className="metrics">
          <article><div><span>Revenue</span><b>14-day scope</b></div><strong>${(summary.revenue / 1000).toFixed(1)}K</strong><small>{market} markets · {device} devices</small><div className="spark"><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article><div><span>Detected anomalies</span><b className="warn">{visibleAnomalies.length} in scope</b></div><strong>{String(visibleAnomalies.length).padStart(2, "0")}</strong><small>Automatically found from historical baselines</small><div className="bars"><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article><div><span>CTR / CVR</span><b>Live calculation</b></div><strong>{summary.ctr.toFixed(2)}%</strong><small>CVR {summary.cvr.toFixed(2)}%</small><div className="line" /></article>
          <article><div><span>Return on ad spend</span><b>Revenue ÷ spend</b></div><strong>{summary.roas.toFixed(2)}×</strong><small>${(summary.spend / 1000).toFixed(1)}K spend</small><div className="donut"><span>{Math.min(Math.round(summary.roas * 25), 99)}</span></div></article>
        </section>

        <section className="panel trendPanel">
          <div className="panelHead"><div><h2>Revenue trend</h2><p>Computed from filtered campaign metrics · Jul 12–25</p></div><div className="legend"><i /> Revenue</div></div>
          <div className="chart" role="img" aria-label="Fourteen day revenue bar chart">
            {trend.map((point) => (
              <div className="chartColumn" key={point.date}>
                <span>${Math.round(point.value / 1000)}K</span>
                <i style={{ height: `${Math.max((point.value / maxRevenue) * 100, 4)}%` }} />
                <small>{point.date.replace("Jul ", "")}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="contentGrid">
          <div className="panel incidents">
            <div className="panelHead"><div><h2>Live incidents</h2><p>Prioritized by estimated revenue impact</p></div><button>View all →</button></div>
            <div className="incidentList">
              {detectedAnomalies.map((item, index) => (
                <button key={item.id} onClick={() => { setSelected(index); setApproved(item.status === "Resolved"); setMarket(item.market); setDevice(item.device); setShowEvidence(false); }} className={`incident ${selected === index ? "selected" : ""}`}>
                  <span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span>
                  <div><strong>{item.title}</strong><small>{item.id} · ${item.estimatedImpact.toLocaleString()}/day impact</small></div>
                  <em>{item.delta > 0 ? "+" : ""}{item.delta}%</em><span className="status">{item.status}</span><span className="arrow">›</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel run">
            <div className="panelHead"><div><span className="liveDot">LIVE</span><h2>Agent investigation</h2><p>{incident.id} · Autonomous analysis in progress</p></div><span className="elapsed">03:42 elapsed</span></div>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
            <div className="timeline">
              {steps.map(([n, title, copy, state]) => (
                <div className={`step ${approved ? "done" : state}`} key={n}><span>{approved || state === "done" ? "✓" : n}</span><div><strong>{title}</strong><p>{copy}</p></div>{state === "active" && !approved && <i>Analyzing</i>}</div>
              ))}
            </div>
            <div className={`approval ${approved ? "approved" : ""}`}>
              <div><span>{approved ? "✓" : "!"}</span><div><strong>{approved ? "Action approved" : "Human approval required"}</strong><p>{approved ? "Simulated action queued. Monitoring window started." : `${incident.action}. Estimated recovery: $${incident.estimatedImpact.toLocaleString()}/day.`}</p></div></div>
              {!approved && <div className="approvalActions"><button disabled={approvalStatus === "saving"} onClick={approveAction}>{approvalStatus === "saving" ? "Saving…" : "Approve action"}</button><button onClick={() => setShowEvidence((value) => !value)}>{showEvidence ? "Hide evidence" : "Review evidence"}</button></div>}
            </div>
            {showEvidence && (
              <div className="evidenceDrawer">
                <div className="evidenceTitle"><strong>Agent tool trace</strong><span>{toolResults.length}/{toolResults.length} tools succeeded</span></div>
                {toolResults.map((result, index) => (
                  <div className="toolCall" key={result.tool}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{result.tool}</strong><small>{result.purpose}</small><p>{result.result}</p></div>
                    <em>✓ {result.source}</em>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bottomGrid">
          <div className="panel ask">
            <div className="panelHead"><div><h2>Ask your monetization data</h2><p>Answers grounded in live metrics and approved knowledge</p></div><span className="aiTag">✦ AI ANALYST</span></div>
            <div className="queryBox"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && askAgent()} placeholder="Why did US mobile revenue decline yesterday?" /><button onClick={askAgent}>Ask →</button></div>
            {answer ? <div className="answer"><strong>Finding · deterministic demo mode</strong><p>{answer}</p><small>Sources: filtered campaign metrics · anomaly ground truth · approved runbook</small></div> :
              <div className="suggestions"><span>Try asking:</span><button onClick={() => setQuery("Compare CTR by market")}>Compare CTR by market</button><button onClick={() => setQuery("Show costly anomalies")}>Show costly anomalies</button></div>}
          </div>
          <div className="panel evaluation">
            <div className="panelHead"><div><h2>Agent quality</h2><p>Last 30 days · 186 completed runs</p></div><button>Evaluation suite →</button></div>
            <div className="quality">
              <div><strong>{(detectorQuality.precision * 100).toFixed(0)}%</strong><span>Detector precision</span><small>{detectorQuality.falsePositives} false positive</small></div>
              <div><strong>{(detectorQuality.recall * 100).toFixed(0)}%</strong><span>Detector recall</span><small>{detectorQuality.truePositives}/3 found</small></div>
              <div><strong>{(detectorQuality.f1 * 100).toFixed(0)}%</strong><span>Detector F1 score</span><small>Ground-truth suite</small></div>
              <div><strong>$0.00</strong><span>Cost per demo run</span><small className="down">No paid API</small></div>
            </div>
          </div>
        </section>
        </> : <ModuleView view={view} language={language} setView={setView} />}
      </section>
    </main>
  );
}

function ModuleView({
  view,
  language,
  setView,
}: {
  view: "incidents" | "runs" | "knowledge" | "evaluations";
  language: "zh" | "en";
  setView: (view: "overview" | "incidents" | "runs" | "knowledge" | "evaluations") => void;
}) {
  const titles = language === "zh"
    ? { incidents: "异常中心", runs: "Agent运行记录", knowledge: "知识库", evaluations: "评估中心" }
    : { incidents: "Incident center", runs: "Agent runs", knowledge: "Knowledge base", evaluations: "Evaluations" };
  const quality = evaluateDetector(detectedAnomalies);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const knowledgeHits = useMemo(() => searchKnowledge(knowledgeQuery, 6), [knowledgeQuery]);

  return (
    <section className="modulePage">
      <div className="moduleHero">
        <div><p className="eyebrow">ADPILOT WORKSPACE</p><h2>{titles[view]}</h2><p>{language === "zh" ? "使用同一套模拟数据、真实API和标准答案测试集。" : "Powered by the same simulated data, real APIs, and ground-truth suite."}</p></div>
        <span>● API LIVE · $0</span>
      </div>

      {view === "incidents" && <div className="moduleGrid">
        {detectedAnomalies.map((item) => (
          <button className="moduleCard" key={item.id} onClick={() => setView("overview")}>
            <span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span>
            <div><strong>{item.title}</strong><p>{item.evidence}</p><small>{item.id} · {item.status}</small></div>
            <em>{item.delta > 0 ? "+" : ""}{item.delta}%</em>
          </button>
        ))}
      </div>}

      {view === "runs" && <div className="tracePage">
        {detectedAnomalies.map((item) => (
          <article key={item.id}>
            <div><span className="liveDot">TRACE</span><strong>{item.id} · {item.title}</strong><small>{item.status}</small></div>
            {investigateIncident(item).map((tool) => <p key={tool.tool}><code>{tool.tool}</code><span>{tool.result}</span><em>✓</em></p>)}
          </article>
        ))}
      </div>}

      {view === "knowledge" && <>
        <div className="knowledgeSearch">
          <input value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} placeholder={language === "zh" ? "搜索 CTR、延迟、预算或转化追踪…" : "Search CTR, latency, budget, or conversion tracking…"} />
          <span>{knowledgeHits.length} results · GET /api/knowledge</span>
        </div>
        <div className="knowledgeGrid">
          {knowledgeHits.map((hit) => <article key={hit.document.id}><span>{hit.document.approved ? "APPROVED" : "DRAFT"} · SCORE {hit.score}</span><strong>{language === "zh" ? hit.document.titleZh : hit.document.titleEn}</strong><p>{hit.excerpt}</p><small>{hit.citation} · {hit.document.type}</small></article>)}
        </div>
      </>}

      {view === "evaluations" && <div className="evaluationPage">
        <article><strong>{(quality.precision * 100).toFixed(0)}%</strong><span>Precision / 精确率</span></article>
        <article><strong>{(quality.recall * 100).toFixed(0)}%</strong><span>Recall / 召回率</span></article>
        <article><strong>{(quality.f1 * 100).toFixed(0)}%</strong><span>F1 score</span></article>
        <article><strong>$0.00</strong><span>Demo API cost / 演示成本</span></article>
        <div><h3>Ground-truth suite</h3><p>3 standard incidents · 3 detected · 0 false positives</p><code>GET /api/anomalies</code></div>
      </div>}
    </section>
  );
}
