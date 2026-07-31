export type Market = "US" | "DE" | "UK";
export type Device = "Mobile" | "Desktop";

export type AdMetric = {
  date: string;
  market: Market;
  device: Device;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  latencyMs: number;
};

export type DetectedAnomaly = {
  id: string;
  title: string;
  market: Market;
  device: Device;
  metric: "CTR" | "Spend" | "Revenue";
  severity: "P1" | "P2";
  delta: number;
  status: "Investigating" | "Awaiting approval" | "Resolved";
  cause: string;
  evidence: string;
  action: string;
  estimatedImpact: number;
  detector?: {
    baseline: number;
    current: number;
    zScore: number;
    changePoint: string;
    latencyDeltaMs?: number;
    method: string;
  };
};

export type InjectionRequest = {
  market: Market;
  device: Device;
  metric: "CTR" | "Spend" | "Revenue";
  deltaPct: number;
};

const dates = [
  "Jul 12", "Jul 13", "Jul 14", "Jul 15", "Jul 16", "Jul 17", "Jul 18",
  "Jul 19", "Jul 20", "Jul 21", "Jul 22", "Jul 23", "Jul 24", "Jul 25",
];

const markets: Market[] = ["US", "DE", "UK"];
const devices: Device[] = ["Mobile", "Desktop"];

export const adMetrics: AdMetric[] = dates.flatMap((date, day) =>
  markets.flatMap((market, marketIndex) =>
    devices.map((device, deviceIndex) => {
      const marketScale = [1.85, 0.82, 0.68][marketIndex];
      const deviceScale = device === "Mobile" ? 1.45 : 0.86;
      const wave = 1 + Math.sin(day * 0.82 + marketIndex) * 0.055;
      const impressions = Math.round(82000 * marketScale * deviceScale * wave);
      let ctr = 0.038 + marketIndex * 0.002 + deviceIndex * 0.003;
      let conversionRate = 0.071 - marketIndex * 0.004;
      let spendMultiplier = 1;
      let latencyMs = 610 + marketIndex * 35 + deviceIndex * 20;

      // Ground-truth anomalies used by the deterministic evaluation suite.
      if (market === "US" && device === "Mobile" && day >= 11) {
        ctr *= 0.816;
        latencyMs += 920;
      }
      if (market === "DE" && device === "Desktop" && day === 13) {
        spendMultiplier = 1.312;
      }
      if (market === "UK" && device === "Mobile" && day === 12) {
        conversionRate *= 0.73;
      }

      const clicks = Math.round(impressions * ctr);
      const conversions = Math.round(clicks * conversionRate);
      const spend = Math.round(clicks * 1.18 * spendMultiplier);
      const revenue = Math.round(conversions * 48.5);

      return { date, market, device, impressions, clicks, conversions, spend, revenue, latencyMs };
    })
  )
);

export const anomalyGroundTruth: DetectedAnomaly[] = [
  {
    id: "INC-2407",
    title: "US · Mobile CTR sudden drop",
    market: "US",
    device: "Mobile",
    metric: "CTR",
    severity: "P1",
    delta: -18.4,
    status: "Investigating",
    cause: "Landing-page latency regression after release v3.18.4",
    evidence: "CTR deviated 3.8σ while mobile latency increased by 920ms",
    action: "Rollback release v3.18.4 and monitor for 20 minutes",
    estimatedImpact: 18200,
  },
  {
    id: "INC-2406",
    title: "DE · Desktop spend spike",
    market: "DE",
    device: "Desktop",
    metric: "Spend",
    severity: "P2",
    delta: 31.2,
    status: "Awaiting approval",
    cause: "Bid multiplier changed from 1.0 to 1.3",
    evidence: "Spend increased 31.2% without a statistically meaningful conversion lift",
    action: "Restore the previous bid multiplier",
    estimatedImpact: 6400,
  },
  {
    id: "INC-2405",
    title: "UK · Mobile revenue decline",
    market: "UK",
    device: "Mobile",
    metric: "Revenue",
    severity: "P2",
    delta: -12.7,
    status: "Resolved",
    cause: "Conversion tracking delayed after a tag configuration change",
    evidence: "Clicks remained stable while recorded conversions fell 27%",
    action: "Restore tag configuration and backfill delayed conversions",
    estimatedImpact: 3900,
  },
];

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function percentDelta(current: number, baseline: number) {
  return baseline ? ((current - baseline) / baseline) * 100 : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function ctr(row: AdMetric) {
  return row.impressions ? row.clicks / row.impressions : 0;
}

export function analyzeCtrShift(series: AdMetric[]) {
  const recent = series.slice(-3);
  const historical = series.slice(0, -3);
  const baseline = historical.reduce((sum, row) => sum + row.clicks, 0) /
    historical.reduce((sum, row) => sum + row.impressions, 0);
  const current = recent.reduce((sum, row) => sum + row.clicks, 0) /
    recent.reduce((sum, row) => sum + row.impressions, 0);
  const observedSigma = standardDeviation(historical.map(ctr));
  // A 5% operational variance floor prevents tiny rounding noise from
  // producing an exaggerated z-score on high-volume simulated traffic.
  const operationalSigma = Math.max(observedSigma, baseline * 0.05);
  const baselineLatency = average(historical.slice(-7).map((row) => row.latencyMs));
  const recentLatency = average(recent.map((row) => row.latencyMs));
  return {
    baseline,
    current,
    delta: percentDelta(current, baseline),
    zScore: operationalSigma ? (current - baseline) / operationalSigma : 0,
    changePoint: recent[0]?.date ?? series.at(-1)?.date ?? "unknown",
    latencyDeltaMs: recentLatency - baselineLatency,
  };
}

/**
 * Deterministic anomaly detector. It never reads anomalyGroundTruth to decide
 * whether an event happened; ground truth is used only after detection to
 * attach demo metadata and calculate evaluation quality.
 */
export function detectAnomalies(rows: AdMetric[]): DetectedAnomaly[] {
  const detections: Array<{
    market: Market;
    device: Device;
    metric: "CTR" | "Spend" | "Revenue";
    delta: number;
    detector: NonNullable<DetectedAnomaly["detector"]>;
  }> = [];

  for (const market of markets) {
    for (const device of devices) {
      const series = rows.filter((row) => row.market === market && row.device === device);
      const recent = series.slice(-3);
      const historical = series.slice(0, -3);
      if (historical.length < 7 || recent.length === 0) continue;

      const ctrShift = analyzeCtrShift(series);
      const ctrDelta = ctrShift.delta;

      const latestSpend = series.at(-1)?.spend ?? 0;
      const spendBaseline = average(series.slice(-8, -1).map((row) => row.spend));
      const spendDelta = percentDelta(latestSpend, spendBaseline);

      const revenueBaseline = average(historical.slice(-7).map((row) => row.revenue));
      const lowestRecentRevenue = Math.min(...recent.map((row) => row.revenue));
      const revenueDelta = percentDelta(lowestRecentRevenue, revenueBaseline);

      // Prioritize the leading indicator so one incident does not create
      // several correlated alerts for the same market-device pair.
      if (ctrDelta <= -15) {
        detections.push({
          market,
          device,
          metric: "CTR",
          delta: ctrDelta,
          detector: {
            baseline: ctrShift.baseline,
            current: ctrShift.current,
            zScore: ctrShift.zScore,
            changePoint: ctrShift.changePoint,
            latencyDeltaMs: ctrShift.latencyDeltaMs,
            method: "11-day baseline + 3-day changepoint + 5% variance floor",
          },
        });
      } else if (spendDelta >= 24.5) {
        detections.push({
          market,
          device,
          metric: "Spend",
          delta: spendDelta,
          detector: {
            baseline: spendBaseline,
            current: latestSpend,
            zScore: standardDeviation(series.slice(-8, -1).map((row) => row.spend))
              ? (latestSpend - spendBaseline) / standardDeviation(series.slice(-8, -1).map((row) => row.spend))
              : 0,
            changePoint: series.at(-1)?.date ?? "unknown",
            method: "7-day rolling baseline + relative change threshold",
          },
        });
      } else if (revenueDelta <= -15) {
        detections.push({
          market,
          device,
          metric: "Revenue",
          delta: revenueDelta,
          detector: {
            baseline: revenueBaseline,
            current: lowestRecentRevenue,
            zScore: standardDeviation(historical.slice(-7).map((row) => row.revenue))
              ? (lowestRecentRevenue - revenueBaseline) / standardDeviation(historical.slice(-7).map((row) => row.revenue))
              : 0,
            changePoint: recent.find((row) => row.revenue === lowestRecentRevenue)?.date ?? "unknown",
            method: "7-day baseline + 3-day minimum changepoint",
          },
        });
      }
    }
  }

  return detections.map((detection, index) => {
    const known = anomalyGroundTruth.find(
      (item) =>
        item.market === detection.market &&
        item.device === detection.device &&
        item.metric === detection.metric
    );

    return known
      ? {
          ...known,
          delta: Number(detection.delta.toFixed(1)),
          evidence: detection.metric === "CTR"
            ? `CTR shifted ${Math.abs(detection.detector.zScore).toFixed(1)}σ while mobile latency rose ${Math.round(detection.detector.latencyDeltaMs ?? 0)}ms`
            : known.evidence,
          detector: detection.detector,
        }
      : {
          id: `INC-AUTO-${index + 1}`,
          title: `${detection.market} · ${detection.device} ${detection.metric} anomaly`,
          severity: Math.abs(detection.delta) >= 25 ? "P1" : "P2",
          status: "Investigating",
          cause: "Pending automated investigation",
          evidence: `${detection.metric} deviated ${Math.abs(detection.delta).toFixed(1)}% from baseline`,
          action: "Start an automated investigation",
          estimatedImpact: 0,
          ...detection,
        };
  });
}

export const detectedAnomalies = detectAnomalies(adMetrics);

export function injectAnomaly(rows: AdMetric[], request: InjectionRequest) {
  const factor = 1 + request.deltaPct / 100;
  const scopedIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.market === request.market && row.device === request.device)
    .slice(-3)
    .map(({ index }) => index);

  return rows.map((row, index) => {
    if (!scopedIndexes.includes(index)) return { ...row };
    if (request.metric === "CTR") {
      const previousCvr = row.clicks ? row.conversions / row.clicks : 0;
      const clicks = Math.max(1, Math.round(row.clicks * factor));
      return { ...row, clicks, conversions: Math.round(clicks * previousCvr) };
    }
    if (request.metric === "Spend") return { ...row, spend: Math.round(row.spend * factor) };
    return { ...row, revenue: Math.round(row.revenue * factor) };
  });
}

export function replaySummary(detected: DetectedAnomaly[]) {
  const quality = compareReplayResults(detected);
  return {
    window: "14-day replay",
    threshold: "CTR ≤ -15%, spend ≥ +24.5%, revenue ≤ -15%",
    knownIncidentsFound: `${quality.truePositives}/${anomalyGroundTruth.length}`,
    unaffectedSegmentsAlerted: quality.falsePositives,
    sampleSize: anomalyGroundTruth.length,
    evaluationLimit: "This is a three-incident replay sanity check, not a production precision/recall claim.",
    tradeoff: "Relaxing the CTR threshold from -15% to -12% increases sensitivity but promotes normal mobile volatility to the watchlist.",
    sensitivity: [
      { ctrThreshold: "-18%", behavior: "Lower alert volume; may miss smaller sustained drops." },
      { ctrThreshold: "-15%", behavior: "Demo operating point; finds the known sustained CTR incident." },
      { ctrThreshold: "-12%", behavior: "Higher sensitivity; normal mobile volatility enters the watchlist." },
    ],
  };
}

function compareReplayResults(
  detected: DetectedAnomaly[],
  expected: DetectedAnomaly[] = anomalyGroundTruth
) {
  const key = (item: DetectedAnomaly) => `${item.market}:${item.device}:${item.metric}`;
  const expectedKeys = new Set(expected.map(key));
  const detectedKeys = new Set(detected.map(key));
  const truePositives = [...detectedKeys].filter((item) => expectedKeys.has(item)).length;
  return { truePositives, falsePositives: detectedKeys.size - truePositives };
}

export function summarize(rows: AdMetric[]) {
  const total = rows.reduce(
    (sum, row) => ({
      impressions: sum.impressions + row.impressions,
      clicks: sum.clicks + row.clicks,
      conversions: sum.conversions + row.conversions,
      spend: sum.spend + row.spend,
      revenue: sum.revenue + row.revenue,
    }),
    { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 }
  );

  return {
    ...total,
    ctr: total.impressions ? (total.clicks / total.impressions) * 100 : 0,
    cvr: total.clicks ? (total.conversions / total.clicks) * 100 : 0,
    roas: total.spend ? total.revenue / total.spend : 0,
  };
}

export function dailyRevenue(rows: AdMetric[]) {
  return dates.map((date) => ({
    date,
    value: rows.filter((row) => row.date === date).reduce((sum, row) => sum + row.revenue, 0),
  }));
}
