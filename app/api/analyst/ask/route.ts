import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Workers AI analyst is available through the deployed Worker runtime.", retryable: true },
    { status: 503 }
  );
}
