"use client";

import { useMemo, useState } from "react";
import {
  adMetrics,
  dailyRevenue,
  detectedAnomalies,
  summarize,
  type Device,
  type Market,
} from "./data";

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [approved, setApproved] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
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
  const summary = useMemo(() => summarize(filteredRows), [filteredRows]);
  const trend = useMemo(() => dailyRevenue(filteredRows), [filteredRows]);
  const maxRevenue = Math.max(...trend.map((point) => point.value), 1);
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

  function askAgent() {
    if (!query.trim()) return;
    setAnswer(
      `${incident.title} is the highest-impact matching event. ${incident.cause}. ` +
      `Evidence: ${incident.evidence}. Recommended action: ${incident.action}.`
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">A</span><span>AdPilot</span></div>
        <nav>
          <button className="navItem active"><span>⌁</span> Overview</button>
          <button className="navItem"><span>⌕</span> Incidents <b>3</b></button>
          <button className="navItem"><span>✣</span> Agent runs</button>
          <button className="navItem"><span>▤</span> Knowledge</button>
          <button className="navItem"><span>◫</span> Evaluations</button>
        </nav>
        <div className="sideBottom">
          <div className="system"><i /> All systems operational</div>
          <div className="profile"><span>YL</span><div><strong>Yilin</strong><small>Monetization Ops</small></div><em>•••</em></div>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <div><p className="eyebrow">MONETIZATION CONTROL CENTER</p><h1>Good evening, Yilin.</h1><p>AdPilot is monitoring a reproducible 14-day advertising dataset.</p></div>
          <div className="headerActions"><button className="iconButton">?</button><button className="iconButton">♟</button><button className="primary">＋ New investigation</button></div>
        </header>

        <section className="filterBar" aria-label="Dashboard filters">
          <div><strong>Data scope</strong><span>All dashboard values update from the same underlying dataset.</span></div>
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
          <span className="datasetBadge">SIMULATED · REPRODUCIBLE</span>
        </section>

        <section className="metrics">
          <article><div><span>Revenue</span><b>14-day scope</b></div><strong>${(summary.revenue / 1000).toFixed(1)}K</strong><small>{market} markets · {device} devices</small><div className="spark"><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article><div><span>Detected anomalies</span><b className="warn">{visibleAnomalies.length} in scope</b></div><strong>{String(visibleAnomalies.length).padStart(2, "0")}</strong><small>Deterministic business rules</small><div className="bars"><i/><i/><i/><i/><i/><i/><i/></div></article>
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
                <button key={item.id} onClick={() => { setSelected(index); setApproved(item.status === "Resolved"); setMarket(item.market); setDevice(item.device); }} className={`incident ${selected === index ? "selected" : ""}`}>
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
              {!approved && <div className="approvalActions"><button onClick={() => setApproved(true)}>Approve action</button><button>Review evidence</button></div>}
            </div>
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
              <div><strong>94.1%</strong><span>Root-cause hit rate</span><small>↗ 3.4%</small></div>
              <div><strong>97.8%</strong><span>Tool success rate</span><small>↗ 1.2%</small></div>
              <div><strong>81.6%</strong><span>Human acceptance</span><small>↗ 6.8%</small></div>
              <div><strong>$0.00</strong><span>Cost per demo run</span><small className="down">No paid API</small></div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
