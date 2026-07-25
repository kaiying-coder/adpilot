"use client";

import { useMemo, useState } from "react";

const incidents = [
  { id: "INC-2407", title: "US · Mobile CTR sudden drop", severity: "P1", delta: "-18.4%", time: "12 min ago", status: "Investigating" },
  { id: "INC-2406", title: "DE · Shopping spend spike", severity: "P2", delta: "+31.2%", time: "46 min ago", status: "Awaiting approval" },
  { id: "INC-2405", title: "UK · Budget exhausted early", severity: "P2", delta: "-12.7%", time: "2 hr ago", status: "Resolved" },
];

const steps = [
  ["01", "Anomaly detected", "CTR deviated 3.8σ from the 28-day baseline.", "done"],
  ["02", "Dimensions investigated", "Region × device × campaign narrowed impact to US mobile brand campaigns.", "done"],
  ["03", "Knowledge retrieved", "Matched runbook RB-014 and two historical incidents.", "done"],
  ["04", "Hypothesis verified", "Landing latency rose 920ms after release v3.18.4.", "active"],
  ["05", "Action proposed", "Rollback v3.18.4 and monitor CTR for 20 minutes.", "pending"],
];

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [approved, setApproved] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const incident = incidents[selected];
  const progress = useMemo(() => (approved ? 100 : selected === 2 ? 100 : 68), [approved, selected]);

  function askAgent() {
    if (!query.trim()) return;
    setAnswer("Revenue decline is concentrated in US mobile traffic. The strongest supported cause is increased landing-page latency after release v3.18.4, with 87% confidence.");
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
          <div><p className="eyebrow">MONETIZATION CONTROL CENTER</p><h1>Good evening, Yilin.</h1><p>AdPilot is monitoring 128 campaigns across 12 markets.</p></div>
          <div className="headerActions"><button className="iconButton">?</button><button className="iconButton">♟</button><button className="primary">＋ New investigation</button></div>
        </header>

        <section className="metrics">
          <article><div><span>Revenue protected</span><b>↗ 14.2%</b></div><strong>$284.6K</strong><small>Estimated this month</small><div className="spark"><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article><div><span>Active anomalies</span><b className="warn">3 open</b></div><strong>03</strong><small>1 requires attention</small><div className="bars"><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article><div><span>Mean time to insight</span><b>↓ 62%</b></div><strong>4m 18s</strong><small>From 11m 24s baseline</small><div className="line" /></article>
          <article><div><span>Agent confidence</span><b>↗ 2.1%</b></div><strong>92.4%</strong><small>Across 186 investigations</small><div className="donut"><span>92</span></div></article>
        </section>

        <section className="contentGrid">
          <div className="panel incidents">
            <div className="panelHead"><div><h2>Live incidents</h2><p>Prioritized by estimated revenue impact</p></div><button>View all →</button></div>
            <div className="incidentList">
              {incidents.map((item, index) => (
                <button key={item.id} onClick={() => { setSelected(index); setApproved(item.status === "Resolved"); }} className={`incident ${selected === index ? "selected" : ""}`}>
                  <span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span>
                  <div><strong>{item.title}</strong><small>{item.id} · {item.time}</small></div>
                  <em>{item.delta}</em><span className="status">{item.status}</span><span className="arrow">›</span>
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
              <div><span>{approved ? "✓" : "!"}</span><div><strong>{approved ? "Action approved" : "Human approval required"}</strong><p>{approved ? "Rollback queued. Monitoring window started." : "Rollback affects 14 campaigns. Estimated recovery: $18.2K/day."}</p></div></div>
              {!approved && <div className="approvalActions"><button onClick={() => setApproved(true)}>Approve rollback</button><button>Review evidence</button></div>}
            </div>
          </div>
        </section>

        <section className="bottomGrid">
          <div className="panel ask">
            <div className="panelHead"><div><h2>Ask your monetization data</h2><p>Answers grounded in live metrics and approved knowledge</p></div><span className="aiTag">✦ AI ANALYST</span></div>
            <div className="queryBox"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && askAgent()} placeholder="Why did US mobile revenue decline yesterday?" /><button onClick={askAgent}>Ask →</button></div>
            {answer ? <div className="answer"><strong>Finding · 87% confidence</strong><p>{answer}</p><small>Sources: Campaign metrics · RB-014 · INC-2319 · Release log</small></div> :
              <div className="suggestions"><span>Try asking:</span><button onClick={() => setQuery("Compare CTR by market")}>Compare CTR by market</button><button onClick={() => setQuery("Show costly anomalies")}>Show costly anomalies</button></div>}
          </div>
          <div className="panel evaluation">
            <div className="panelHead"><div><h2>Agent quality</h2><p>Last 30 days · 186 completed runs</p></div><button>Evaluation suite →</button></div>
            <div className="quality">
              <div><strong>94.1%</strong><span>Root-cause hit rate</span><small>↗ 3.4%</small></div>
              <div><strong>97.8%</strong><span>Tool success rate</span><small>↗ 1.2%</small></div>
              <div><strong>81.6%</strong><span>Human acceptance</span><small>↗ 6.8%</small></div>
              <div><strong>$0.42</strong><span>Cost per run</span><small className="down">↓ 18%</small></div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
