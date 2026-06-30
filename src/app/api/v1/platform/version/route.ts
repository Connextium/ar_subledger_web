import { ok } from "@/app/api/v1/_shared/route-utils";

export async function GET(request: Request) {
  return ok(request, { version: "1.0.0", apiVersion: "v1" });
}
