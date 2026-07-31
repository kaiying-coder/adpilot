import { NextResponse } from "next/server";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (id !== "INC-2407") {
    return NextResponse.json(
      { error: "Live Workers AI is intentionally scoped to INC-2407." },
      { status: 400 }
    );
  }
  return NextResponse.json(
    {
      error: "Workers AI binding is available through the deployed Worker runtime.",
      retryable: true,
    },
    { status: 503 }
  );
}
