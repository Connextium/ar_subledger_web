import { acceptedMutation } from "@/app/api/v1/_shared/route-utils";

export async function DELETE(request: Request) {
  return acceptedMutation(request, { revoked: true });
}
