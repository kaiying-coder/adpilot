"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adMetrics,
  dailyRevenue,
  detectedAnomalies,
  replaySummary,
  summarize,
  type Device,
  type InjectionRequest,
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
  const [liveRunStatus, setLiveRunStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [liveRunError, setLiveRunError] = useState("");
  const [liveRunSlow, setLiveRunSlow] = useState(false);
  const [liveRun, setLiveRun] = useState<{
    model: string;
    trace: Array<{
      step: number;
      decision: string;
      observation: { tool: string; purpose: string; result: string; source: string };
    }>;
    conclusion: {
      hypothesis: string;
      evidence: string[];
      recommendedAction: string;
      confidence: number;
      rationale: string;
    };
    billing: { freeAllocation: string };
  } | null>(null);
  const [injection, setInjection] = useState<InjectionRequest>({
    market: "DE",
    device: "Mobile",
    metric: "CTR",
    deltaPct: -28,
  });
  const [scanStatus, setScanStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [scanResult, setScanResult] = useState<{
    detected: boolean;
    rowsScanned: number;
    anomaly: { id: string; delta: number; detector?: { zScore: number; changePoint: string } } | null;
  } | null>(null);
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
  const replay = useMemo(() => replaySummary(detectedAnomalies), []);
  const isLiveIncident = incident.id === "INC-2407";
  const toolResults = useMemo(
    () => incident.id === "INC-2407" ? [] : investigateIncident(incident),
    [incident]
  );
  const displayedToolResults = isLiveIncident
    ? (liveRun?.trace.map((item) => item.observation) ?? [])
    : toolResults;
  const visibleAnomalies = detectedAnomalies.filter((item) =>
    (market === "All" || item.market === market) &&
    (device === "All" || item.device === device)
  );
  const progress = approved
    ? 100
    : isLiveIncident
      ? liveRun ? 88 : liveRunStatus === "running" ? 42 : 20
      : selected === 2 ? 100 : 68;
  const revenueProtected = visibleAnomalies.reduce((sum, item) => sum + item.estimatedImpact, 0);
  const uiCopy = language === "zh"
    ? {
        anomalyDetected: "检测到异常",
        investigationPlanned: "制定调查计划",
        evidenceObserved: "获取真实证据",
        hypothesisGenerated: "生成根因假设",
        actionProposed: "提出处置建议",
        analyzing: "分析中",
      }
    : {
        anomalyDetected: "Anomaly detected",
        investigationPlanned: "Investigation planned",
        evidenceObserved: "Evidence observed",
        hypothesisGenerated: "Hypothesis generated",
        actionProposed: "Action proposed",
        analyzing: "Analyzing",
      };
  const steps = isLiveIncident
    ? [
        ["01", uiCopy.anomalyDetected, language === "zh" ? `${incident.metric} 相对统计基线变化 ${Math.abs(incident.delta)}%。` : `${incident.metric} moved ${Math.abs(incident.delta)}% from its statistical baseline.`, "done"],
        ["02", uiCopy.investigationPlanned, liveRun ? (language === "zh" ? `真实调查已选择并执行 ${liveRun.trace.length} 个只读工具。` : `${liveRun.trace.length} read-only tools selected and executed by the live investigation.`) : liveRunStatus === "running" ? (language === "zh" ? "Workers AI 正在选择证据工具。" : "Workers AI is selecting evidence tools now.") : liveRunStatus === "error" ? (language === "zh" ? "模型调查中断；检测器结果已保留。" : "Model investigation interrupted; detector output preserved.") : (language === "zh" ? "尚未开始——运行真实 AI 调查后生成计划。" : "Not started — run the live AI investigation to create a plan."), liveRun ? "done" : liveRunStatus === "running" ? "active" : liveRunStatus === "error" ? "done" : "pending"],
        ["03", uiCopy.evidenceObserved, liveRun ? (language === "zh" ? `${liveRun.trace.length}/${liveRun.trace.length} 个工具已从 14 天数据和已批准知识中返回观测。` : `${liveRun.trace.length}/${liveRun.trace.length} tool observations returned from the 14-day dataset and approved knowledge.`) : liveRunStatus === "error" ? (language === "zh" ? "未将不完整的模型观测作为证据。" : "No incomplete model observation was accepted as evidence.") : (language === "zh" ? "暂无工具观测。" : "No tool observations yet."), liveRun ? "done" : liveRunStatus === "error" ? "done" : "pending"],
        ["04", uiCopy.hypothesisGenerated, liveRun?.conclusion.hypothesis ?? (liveRunStatus === "error" ? (language === "zh" ? "仅检测器降级：异常已确认，根因未经验证。" : "Detector-only fallback: anomaly confirmed, root cause unverified.") : (language === "zh" ? "运行前不存在 LLM 根因假设。" : "No LLM hypothesis exists before execution.")), liveRun ? "done" : liveRunStatus === "error" ? "active" : "pending"],
        ["05", uiCopy.actionProposed, liveRun?.conclusion.recommendedAction ?? (liveRunStatus === "error" ? (language === "zh" ? "升级人工分析；不执行自动处置。" : "Escalate to a human analyst; do not execute an automated action.") : (language === "zh" ? "尚未提出处置建议。" : "No action has been proposed.")), liveRun ? "active" : "pending"],
      ]
    : [
        ["01", uiCopy.anomalyDetected, language === "zh" ? `${incident.metric} 相对预期基线变化 ${Math.abs(incident.delta)}%。` : `${incident.metric} moved ${Math.abs(incident.delta)}% from its expected baseline.`, "done"],
        ["02", language === "zh" ? "分析影响维度" : "Dimensions investigated", language === "zh" ? `影响范围已缩小至 ${incident.market} · ${incident.device} 流量。` : `Impact narrowed to ${incident.market} · ${incident.device} traffic.`, "done"],
        ["03", language === "zh" ? "检索业务知识" : "Knowledge retrieved", language === "zh" ? "已匹配相关运行手册和两个历史事件。" : "Matched the relevant runbook and two historical incidents.", "done"],
        ["04", language === "zh" ? "验证根因假设" : "Hypothesis verified", incident.evidence, "active"],
        ["05", uiCopy.actionProposed, incident.action, "pending"],
      ];
  const labels = language === "zh"
    ? {
        overview: "总览", incidents: "异常中心", runs: "Agent 运行", knowledge: "知识库", evaluations: "评估中心",
        hello: "AdPilot 演示工作区", subtitle: "14 天广告数据回放 · INC-2407 使用真实 LLM 和工具调用。", action: "开始 30 秒演示",
        controlCenter: "商业化控制中心", systems: "所有系统运行正常", scope: "数据范围",
        scopeHint: "整页指标由筛选条件驱动，对 14 天数据重新计算。", revenue: "收入", anomaly: "检测异常",
        ctrCvr: "点击率 / 转化率", roas: "广告投入回报率", trend: "收入趋势",
        liveIncidents: "回放异常", priority: "按预估收入影响排序", investigation: "Agent 调查",
        approval: "需要人工审批", approve: "批准操作", evidence: "查看证据", hideEvidence: "收起证据",
        ask: "询问商业化数据", askHint: "回答基于当前回放指标和已批准知识", quality: "Agent 质量",
      }
    : {
        overview: "Overview", incidents: "Incidents", runs: "Agent runs", knowledge: "Knowledge", evaluations: "Evaluations",
        hello: "AdPilot demo workspace", subtitle: "14-day ad data replay · INC-2407 uses a real LLM and tool calls.", action: "Start 30-second demo",
        controlCenter: "MONETIZATION CONTROL CENTER", systems: "All systems operational", scope: "Data scope",
        scopeHint: "All dashboard values update through the AdPilot API.", revenue: "Revenue", anomaly: "Detected anomalies",
        ctrCvr: "CTR / CVR", roas: "Return on ad spend", trend: "Revenue trend",
        liveIncidents: "Replay incidents", priority: "Prioritized by estimated revenue impact", investigation: "Agent investigation",
        approval: "Human approval required", approve: "Approve action", evidence: "Review evidence", hideEvidence: "Hide evidence",
        ask: "Ask your monetization data", askHint: "Answers grounded in replay metrics and approved knowledge", quality: "Agent quality",
      };

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

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

  async function runLiveInvestigation() {
    setLiveRunStatus("running");
    setLiveRun(null);
    setLiveRunError("");
    setLiveRunSlow(false);
    setShowEvidence(true);
    const controller = new AbortController();
    const slowTimer = window.setTimeout(() => setLiveRunSlow(true), 8000);
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch("/api/investigations/INC-2407/run", {
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.errorCode ?? payload?.error ?? "AI_UPSTREAM_ERROR");
      }
      setLiveRun(await response.json());
      setLiveRunStatus("done");
    } catch (error) {
      setLiveRunError(
        error instanceof DOMException && error.name === "AbortError"
          ? "AI_TIMEOUT"
          : error instanceof Error ? error.message : "AI_UPSTREAM_ERROR"
      );
      setLiveRunStatus("error");
    } finally {
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeout);
      setLiveRunSlow(false);
    }
  }

  function startGuidedDemo() {
    setView("overview");
    setSelected(0);
    setApproved(false);
    setMarket("US");
    setDevice("Mobile");
    setShowEvidence(false);
    setLiveRun(null);
    setLiveRunStatus("idle");
    window.requestAnimationFrame(() => document.getElementById("live-investigation")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function scanInjectedAnomaly() {
    setScanStatus("running");
    setScanResult(null);
    try {
      const response = await fetch("/api/anomalies/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(injection),
      });
      if (!response.ok) throw new Error("Scan failed");
      setScanResult(await response.json());
      setScanStatus("done");
    } catch {
      setScanStatus("error");
    }
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
          <div className="system"><i /> {labels.systems}</div>
          <div className="profile"><span>AP</span><div><strong>Demo Workspace</strong><small>Monetization Ops</small></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <div><p className="eyebrow">{labels.controlCenter}</p><h1>{labels.hello}</h1><p>{labels.subtitle}</p></div>
          <div className="headerActions"><button onClick={() => setLanguage(language === "zh" ? "en" : "zh")} className="languageButton">{language === "zh" ? "EN" : "中文"}</button><button onClick={startGuidedDemo} className="primary">{labels.action}</button></div>
        </header>

        {view === "overview" ? <>
        <section className="demoGuide" aria-label={language === "zh" ? "推荐演示路径" : "Recommended demo path"}>
          <span className="demoGuideIcon">▶</span>
          <div><strong>{language === "zh" ? "推荐演示 · 约 30 秒" : "Recommended demo · about 30 seconds"}</strong><p>{language === "zh" ? "运行 INC-2407 → 查看真实工具调用 → 在人工审批闸门前停止" : "Run INC-2407 → inspect real tool calls → stop at the human approval gate"}</p></div>
          <button onClick={startGuidedDemo}>{language === "zh" ? "定位真实调查 ↓" : "Jump to live investigation ↓"}</button>
        </section>
        <section className="filterBar" aria-label="Dashboard filters">
          <div><strong>{labels.scope}</strong><span>{labels.scopeHint}</span></div>
          <label>{language === "zh" ? "市场" : "Market"}
            <select value={market} onChange={(event) => setMarket(event.target.value as Market | "All")}>
              <option>All</option><option>US</option><option>DE</option><option>UK</option>
            </select>
          </label>
          <label>{language === "zh" ? "设备" : "Device"}
            <select value={device} onChange={(event) => setDevice(event.target.value as Device | "All")}>
              <option>All</option><option>Mobile</option><option>Desktop</option>
            </select>
          </label>
          <span className="datasetBadge">{apiLive ? "API LIVE" : "LOCAL FALLBACK"} · 14-DAY REPLAY</span>
        </section>

        <section className="metrics">
          <article><div><span>{language === "zh" ? "可挽回收入" : "Revenue protected"}</span><b>{language === "zh" ? "每日风险" : "DAILY RISK"}</b></div><strong>${(revenueProtected / 1000).toFixed(1)}K/day</strong><small>{language === "zh" ? "经人工审批后执行处置" : "Actions remain human-approved"}</small><div className="spark"><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article><div><span>{labels.anomaly}</span><b className="warn">{visibleAnomalies.length} {language === "zh" ? "个" : "in scope"}</b></div><strong>{String(visibleAnomalies.length).padStart(2, "0")}</strong><small>{language === "zh" ? "根据历史基线自动发现" : "Automatically found from historical baselines"}</small><div className="bars"><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article><div><span>{language === "zh" ? "调查耗时" : "Investigation time"}</span><b>{language === "zh" ? "内部提效" : "OPS ROI"}</b></div><strong>4h → 3m</strong><small>{language === "zh" ? "模拟人工排查基线 → Agent 演示" : "Manual baseline → agent demo"}</small><div className="line" /></article>
          <article><div><span>{labels.roas}</span><b>{language === "zh" ? "筛选联动" : "FILTERED"}</b></div><strong>{summary.roas.toFixed(2)}×</strong><small>{summary.ctr.toFixed(2)}% CTR · {summary.cvr.toFixed(2)}% CVR</small><div className="donut"><span>{Math.min(Math.round(summary.roas * 25), 99)}</span></div></article>
        </section>

        <section className="panel trendPanel">
          <div className="panelHead"><div><h2>{labels.trend}</h2><p>{language === "zh" ? "由筛选后的广告指标计算 · 7月12–25日" : "Computed from filtered campaign metrics · Jul 12–25"}</p></div><div className="legend"><i /> {labels.revenue}</div></div>
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
            <div className="panelHead"><div><h2>{labels.liveIncidents}</h2><p>{labels.priority}</p></div><button onClick={() => setView("incidents")}>{language === "zh" ? "查看全部 →" : "View all →"}</button></div>
            <div className="incidentList">
              {detectedAnomalies.map((item, index) => (
                <button key={item.id} onClick={() => { setSelected(index); setApproved(item.status === "Resolved"); setMarket(item.market); setDevice(item.device); setShowEvidence(false); }} className={`incident ${selected === index ? "selected" : ""}`}>
                  <span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span>
                  <div><strong>{localizedIncidentTitle(item.id, item.title, language)}</strong><small>{item.id} · ${item.estimatedImpact.toLocaleString()}/{language === "zh" ? "日影响" : "day impact"}</small></div>
                  <em>{item.delta > 0 ? "+" : ""}{item.delta}%</em><span className="status">{localizedStatus(item.status, language)}</span><span className="arrow">›</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel run" id="live-investigation">
            <div className="panelHead">
              <div>
                <span className="liveDot">{incident.id === "INC-2407" ? "WORKERS AI · REAL LLM" : (language === "zh" ? "确定性回放" : "DETERMINISTIC REPLAY")}</span>
                <h2>{labels.investigation}</h2>
                <p>{incident.id} · {incident.id === "INC-2407" ? (language === "zh" ? "真实模型 + 真实工具结果" : "Real model + computed tool results") : (language === "zh" ? "规则调查回放" : "Rule-based investigation replay")}</p>
              </div>
              {incident.id === "INC-2407" ? (
                <button className="liveRunButton" disabled={liveRunStatus === "running"} onClick={runLiveInvestigation}>
                  {liveRunStatus === "running"
                    ? (language === "zh" ? "LLM 推理中…" : "LLM reasoning…")
                    : (language === "zh" ? "▶ 运行真实 AI 调查" : "▶ Run live AI")}
                </button>
              ) : <span className="elapsed">14-DAY REPLAY</span>}
            </div>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
            {liveRunStatus === "running" && (
              <div className="liveProgress" role="status" aria-live="polite">
                <span className="progressPulse">✦</span>
                <div>
                  <strong>{liveRunSlow ? (language === "zh" ? "调查仍在运行" : "Investigation is still running") : (language === "zh" ? "Workers AI 正在调查" : "Workers AI is investigating")}</strong>
                  <p>{liveRunSlow ? (language === "zh" ? "免费模型可能正在冷启动；已保留检测结果，可安全等待。" : "The free model may be cold-starting. Detector evidence is preserved and it is safe to wait.") : (language === "zh" ? "制定计划 → 查询指标 → 检索知识 → 生成结论" : "Plan → query metrics → retrieve knowledge → conclude")}</p>
                </div>
                <small>{liveRunSlow ? "8s+" : "LIVE"}</small>
              </div>
            )}
            <div className="timeline">
              {steps.map(([n, title, copy, state]) => (
                <div className={`step ${approved ? "done" : state}`} key={n}><span>{approved || state === "done" ? "✓" : n}</span><div><strong>{title}</strong><p>{copy}</p></div>{state === "active" && !approved && <i>{uiCopy.analyzing}</i>}</div>
              ))}
            </div>
            <div className={`approval ${approved ? "approved" : ""} ${isLiveIncident && !liveRun ? "locked" : ""}`}>
              <div><span>{approved ? "✓" : isLiveIncident && !liveRun ? liveRunStatus === "error" ? "↑" : "○" : "!"}</span><div><strong>{approved ? (language === "zh" ? "操作已批准" : "Action approved") : isLiveIncident && !liveRun ? liveRunStatus === "error" ? (language === "zh" ? "已升级人工调查" : "Escalated to human investigation") : (language === "zh" ? "等待真实调查结果" : "Awaiting live investigation") : labels.approval}</strong><p>{approved ? (language === "zh" ? "模拟操作已排队，恢复监控窗口已启动。" : "Simulated action queued. Monitoring window started.") : isLiveIncident && !liveRun ? liveRunStatus === "error" ? (language === "zh" ? "统计异常仍然有效，但根因未经模型验证；审批和自动处置保持锁定。" : "The statistical anomaly remains valid, but the root cause is unverified. Approval and automated execution remain locked.") : (language === "zh" ? "运行前没有根因结论或处置动作；高风险操作入口保持锁定。" : "No root-cause conclusion or action exists before the run; high-risk execution stays locked.") : `${liveRun?.conclusion.recommendedAction ?? incident.action}. ${language === "zh" ? "预计恢复" : "Estimated recovery"}: $${incident.estimatedImpact.toLocaleString()}/day.`}</p></div></div>
              {!approved && (!isLiveIncident || liveRun) && <div className="approvalActions"><button disabled={approvalStatus === "saving"} onClick={approveAction}>{approvalStatus === "saving" ? (language === "zh" ? "保存中…" : "Saving…") : labels.approve}</button><button onClick={() => setShowEvidence((value) => !value)}>{showEvidence ? labels.hideEvidence : labels.evidence}</button></div>}
            </div>
            {liveRunStatus === "error" && <div className="degradedResult" role="status">
              <div><strong>{language === "zh" ? "降级结论 · 仅检测器" : "Degraded result · detector only"}</strong><span>35% confidence</span></div>
              <p>{language === "zh" ? "统计异常已确认；LLM 调查未完成，根因未知。" : "Statistical anomaly confirmed; LLM investigation incomplete and root cause unknown."}</p>
              <small>{language === "zh" ? "建议：升级人工分析，不执行自动处置。" : "Recommendation: escalate to a human analyst; execute no automated action."} · {liveRunError}</small>
            </div>}
            {liveRun && incident.id === "INC-2407" && (
              <div className="llmConclusion">
                <div><strong>{language === "zh" ? "LLM 结论" : "LLM conclusion"}</strong><span>{Math.round(liveRun.conclusion.confidence * 100)}% confidence</span></div>
                <p>{liveRun.conclusion.hypothesis}</p>
                <small>{liveRun.conclusion.recommendedAction} · {liveRun.model}</small>
              </div>
            )}
            {showEvidence && displayedToolResults.length > 0 && (
              <div className="evidenceDrawer">
                <div className="evidenceTitle"><strong>{liveRun ? (language === "zh" ? "真实 LLM 决策与工具轨迹" : "Live LLM decision + tool trace") : (language === "zh" ? "规则回放工具轨迹" : "Replay tool trace")}</strong><span>{language === "zh" ? `${displayedToolResults.length}/${displayedToolResults.length} 个工具成功` : `${displayedToolResults.length}/${displayedToolResults.length} tools succeeded`}</span></div>
                {displayedToolResults.map((result, index) => (
                  <div className="toolCall" key={`${result.tool}-${index}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{result.tool}</strong>
                      <small>{liveRun?.trace[index]?.decision ?? result.purpose}</small>
                      <p>{result.result}</p>
                    </div>
                    <em>✓ {result.source}</em>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel replayLab">
          <div className="panelHead">
            <div>
              <span className="liveDot">UNSEEN INPUT TEST</span>
              <h2>{language === "zh" ? "注入一个新异常，让检测器现场扫描" : "Inject a new anomaly and scan it live"}</h2>
              <p>{language === "zh" ? "修改内存中的 14 天数据副本；不是回放预设 incident，也不会改动线上数据。" : "Mutates an in-memory copy of the 14-day table; no preset incident and no persistent data change."}</p>
            </div>
            <span className="datasetBadge">POST /api/anomalies/scan</span>
          </div>
          <div className="labControls">
            <label>{language === "zh" ? "市场" : "Market"}
              <select value={injection.market} onChange={(event) => setInjection({ ...injection, market: event.target.value as Market })}>
                <option>US</option><option>DE</option><option>UK</option>
              </select>
            </label>
            <label>{language === "zh" ? "设备" : "Device"}
              <select value={injection.device} onChange={(event) => setInjection({ ...injection, device: event.target.value as Device })}>
                <option>Mobile</option><option>Desktop</option>
              </select>
            </label>
            <label>{language === "zh" ? "指标" : "Metric"}
              <select value={injection.metric} onChange={(event) => {
                const metric = event.target.value as InjectionRequest["metric"];
                setInjection({ ...injection, metric, deltaPct: metric === "Spend" ? 40 : -28 });
              }}>
                <option>CTR</option><option>Spend</option><option>Revenue</option>
              </select>
            </label>
            <label>{language === "zh" ? "注入变化" : "Injected change"}
              <input type="number" min="-80" max="100" value={injection.deltaPct} onChange={(event) => setInjection({ ...injection, deltaPct: Number(event.target.value) })} />
              <span>%</span>
            </label>
            <button disabled={scanStatus === "running"} onClick={scanInjectedAnomaly}>
              {scanStatus === "running" ? (language === "zh" ? "扫描 84 行…" : "Scanning 84 rows…") : (language === "zh" ? "注入并扫描 →" : "Inject & scan →")}
            </button>
          </div>
          {scanResult && (
            <div className={`scanResult ${scanResult.detected ? "found" : "clear"}`}>
              <strong>{scanResult.detected ? (language === "zh" ? "✓ 检测到未预设异常" : "✓ Unseen anomaly detected") : (language === "zh" ? "未越过当前阈值" : "Below current threshold")}</strong>
              <p>{scanResult.rowsScanned} rows scanned · {injection.market} × {injection.device} × {injection.metric} · injected {injection.deltaPct > 0 ? "+" : ""}{injection.deltaPct}%</p>
              {scanResult.anomaly && <small>{scanResult.anomaly.id} · observed {scanResult.anomaly.delta}% · {Math.abs(scanResult.anomaly.detector?.zScore ?? 0).toFixed(1)}σ · changepoint {scanResult.anomaly.detector?.changePoint}</small>}
            </div>
          )}
          {scanStatus === "error" && <div className="runError">{language === "zh" ? "扫描失败，请重试。" : "Scan failed. Retry."}</div>}
        </section>

        <section className="bottomGrid">
          <div className="panel ask">
            <div className="panelHead"><div><h2>{labels.ask}</h2><p>{labels.askHint}</p></div><span className="aiTag">✦ AI ANALYST</span></div>
            <div className="queryBox"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && askAgent()} placeholder={language === "zh" ? "为什么美国移动端收入昨天下降？" : "Why did US mobile revenue decline yesterday?"} /><button onClick={askAgent}>{language === "zh" ? "提问 →" : "Ask →"}</button></div>
            {answer ? <div className="answer"><strong>{language === "zh" ? "结论 · 基于 14 天回放" : "Finding · grounded 14-day replay"}</strong><p>{answer}</p><small>{language === "zh" ? "来源：筛选后的广告指标 · 检测事件 · 已批准运行手册" : "Sources: filtered campaign metrics · detected incident · approved runbook"}</small></div> :
              <div className="suggestions"><span>{language === "zh" ? "试着问：" : "Try asking:"}</span><button onClick={() => setQuery("Compare CTR by market")}>{language === "zh" ? "按市场比较 CTR" : "Compare CTR by market"}</button><button onClick={() => setQuery("Show costly anomalies")}>{language === "zh" ? "显示高成本异常" : "Show costly anomalies"}</button></div>}
          </div>
          <div className="panel evaluation">
            <div className="panelHead"><div><h2>{labels.quality}</h2><p>{language === "zh" ? "诚实的 14 天回放说明，不把 N=3 包装成满分模型" : "Honest 14-day replay, not a 100% claim on N=3"}</p></div><button onClick={() => setView("evaluations")}>{language === "zh" ? "评估说明 →" : "Evaluation notes →"}</button></div>
            <div className="quality">
              <div><strong>{replay.knownIncidentsFound}</strong><span>{language === "zh" ? "命中的已知事件" : "Known incidents found"}</span><small>{language === "zh" ? "在声明阈值下" : "at declared thresholds"}</small></div>
              <div><strong>{replay.unaffectedSegmentsAlerted}</strong><span>{language === "zh" ? "未受影响分组告警" : "Unaffected segments alerted"}</span><small>{language === "zh" ? "本次回放" : "in this replay"}</small></div>
              <div><strong>-15%</strong><span>{language === "zh" ? "CTR 告警阈值" : "CTR alert threshold"}</span><small>{language === "zh" ? "已记录取舍" : "trade-off documented"}</small></div>
              <div><strong>$0 key</strong><span>{language === "zh" ? "所需付费 API 密钥" : "Paid API key required"}</span><small className="down">Workers AI free allocation</small></div>
            </div>
          </div>
        </section>
        </> : <ModuleView view={view} language={language} setView={setView} />}
      </section>
    </main>
  );
}

function localizedIncidentTitle(id: string, fallback: string, language: "zh" | "en") {
  if (language === "en") return fallback;
  const titles: Record<string, string> = {
    "INC-2407": "美国 · 移动端 CTR 突然下降",
    "INC-2406": "德国 · 桌面端广告支出激增",
    "INC-2405": "英国 · 移动端收入下降",
  };
  return titles[id] ?? fallback;
}

function localizedStatus(status: string, language: "zh" | "en") {
  if (language === "en") return status;
  const statuses: Record<string, string> = {
    "Investigating": "调查中",
    "Awaiting approval": "等待审批",
    "Resolved": "已解决",
  };
  return statuses[status] ?? status;
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
  const quality = replaySummary(detectedAnomalies);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const knowledgeHits = useMemo(() => searchKnowledge(knowledgeQuery, 6), [knowledgeQuery]);

  return (
    <section className="modulePage">
      <div className="moduleHero">
        <div><p className="eyebrow">ADPILOT WORKSPACE</p><h2>{titles[view]}</h2><p>{language === "zh" ? "14 天统计检测回放；INC-2407 使用真实 Workers AI 推理。" : "14-day statistical replay; INC-2407 uses live Workers AI inference."}</p></div>
        <span>● WORKERS AI · FREE ALLOCATION</span>
      </div>

      {view === "incidents" && <div className="moduleGrid">
        {detectedAnomalies.map((item) => (
          <button className="moduleCard" key={item.id} onClick={() => setView("overview")}>
            <span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span>
            <div><strong>{localizedIncidentTitle(item.id, item.title, language)}</strong><p>{item.evidence}</p><small>{item.id} · {localizedStatus(item.status, language)}</small></div>
            <em>{item.delta > 0 ? "+" : ""}{item.delta}%</em>
          </button>
        ))}
      </div>}

      {view === "runs" && <div className="tracePage">
        {detectedAnomalies.map((item) => (
          <article key={item.id}>
            <div><span className="liveDot">TRACE</span><strong>{item.id} · {localizedIncidentTitle(item.id, item.title, language)}</strong><small>{localizedStatus(item.status, language)}</small></div>
            {item.id === "INC-2407"
              ? <p><code>live_only</code><span>{language === "zh" ? "该事件的 trace 不预置；请从总览运行真实 AI 调查后查看。" : "No trace is preloaded. Run the live AI investigation from Overview to generate it."}</span><em>○</em></p>
              : investigateIncident(item).map((tool) => <p key={tool.tool}><code>{tool.tool}</code><span>{tool.result}</span><em>✓</em></p>)}
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
        <article><strong>{quality.knownIncidentsFound}</strong><span>Known incidents found / 已知事件</span></article>
        <article><strong>{quality.unaffectedSegmentsAlerted}</strong><span>Unaffected alerts / 未受影响分组告警</span></article>
        <article><strong>-15%</strong><span>CTR threshold / 告警阈值</span></article>
        <article><strong>10K/day</strong><span>Free Workers AI neurons</span></article>
        <div><h3>14-day replay disclosure</h3><p>{quality.threshold}. {quality.tradeoff}</p><code>GET /api/evaluations</code></div>
      </div>}
    </section>
  );
}
