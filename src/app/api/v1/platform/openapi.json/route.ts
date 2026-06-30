import { NextResponse } from "next/server";
import { openApiDocument } from "@/app/api/v1/_shared/openapi";

export async function GET() {
  return NextResponse.json(openApiDocument);
}
