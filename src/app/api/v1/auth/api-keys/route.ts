import { acceptedMutation, ok } from "@/app/api/v1/_shared/route-utils";

export async function GET(request: Request) {
  return ok(request, { apiKeys: [] });
}

export async function POST(request: Request) {
  return acceptedMutation(request, { apiKey: null, record: null });
}
