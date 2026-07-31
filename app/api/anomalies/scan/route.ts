import { NextResponse } from "next/server";
import {
  adMetrics,
  detectAnomalies,
  injectAnomaly,
  type Device,
  type InjectionRequest,
  type Market,
} from "../../../data";

const markets: Market[] = ["US", "DE", "UK"];
const devices: Device[] = ["Mobile", "Desktop"];
const metrics: InjectionRequest["metric"][] = ["CTR", "Spend", "Revenue"];

export async function POST(request: Request) {
  const body = await request.json() as Partial<InjectionRequest>;
  if (
    !body.market || !markets.includes(body.market) ||
    !body.device || !devices.includes(body.device) ||
    !body.metric || !metrics.includes(body.metric) ||
    typeof body.deltaPct !== "number" ||
    body.deltaPct < -80 || body.deltaPct > 100
  ) {
    return NextResponse.json(
      { error: "market, device, metric and deltaPct (-80 to 100) are required." },
      { status: 400 }
    );
  }

  const injectedRows = injectAnomaly(adMetrics, body as InjectionRequest);
  const anomalies = detectAnomalies(injectedRows);
  const match = anomalies.find(
    (item) =>
      item.market === body.market &&
      item.device === body.device &&
      item.metric === body.metric
  );

  return NextResponse.json({
    mode: "on-demand-14-day-scan",
    input: body,
    rowsScanned: injectedRows.length,
    detected: Boolean(match),
    anomaly: match ?? null,
    allDetections: anomalies,
    note: "The request mutates an in-memory copy only; the published replay dataset is unchanged.",
  });
}

