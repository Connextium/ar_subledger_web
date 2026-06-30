import assert from "node:assert/strict";
import { apiError, apiSuccess } from "@/app/api/v1/_shared/api-response";

async function main() {
  const success = apiSuccess({ ok: true }, { requestId: "req_test", workspaceId: "ws_1" });
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), {
    data: { ok: true },
    meta: { apiVersion: "v1", requestId: "req_test", workspaceId: "ws_1" },
  });

  const error = apiError("validation_failed", "Invalid request.", 400, { field: "amount" }, "req_test");
  assert.equal(error.status, 400);
  assert.deepEqual(await error.json(), {
    error: {
      code: "validation_failed",
      message: "Invalid request.",
      details: { field: "amount" },
    },
    meta: { apiVersion: "v1", requestId: "req_test" },
  });
}

void main();
