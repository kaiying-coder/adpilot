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

export const detectedAnomalies: DetectedAnomaly[] = [
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
