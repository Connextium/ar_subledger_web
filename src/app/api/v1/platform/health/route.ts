import { ok } from "@/app/api/v1/_shared/route-utils";

export async function GET(request: Request) {
  return ok(request, { status: "ok", service: "ar-subledger-api" });
}
