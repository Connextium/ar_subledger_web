import { NextResponse } from "next/server";
import { registerSettlementDocumentSchema } from "@/lib/validation/schemas";

export async function GET() {
  return NextResponse.json({ documents: [] });
}

export async function POST(request: Request) {
  const parsed = registerSettlementDocumentSchema.safeParse(await request.json());
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
