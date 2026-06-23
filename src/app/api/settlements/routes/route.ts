import { NextResponse } from "next/server";
import { initializeSettlementRouteSchema } from "@/lib/validation/schemas";

export async function GET() {
  return NextResponse.json({ routes: [] });
}

export async function POST(request: Request) {
  const parsed = initializeSettlementRouteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(
    {
      input: parsed.data,
      signing: "client_required",
    },
    { status: 202 },
  );
}
