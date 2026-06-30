import assert from "node:assert/strict";
import { requireIdempotencyKey } from "@/app/api/v1/_shared/idempotency";

const okRequest = new Request("http://localhost/api/v1/buyer/test", {
  method: "POST",
  headers: { "idempotency-key": "idem_123" },
});
assert.equal(requireIdempotencyKey(okRequest), "idem_123");

const missingRequest = new Request("http://localhost/api/v1/buyer/test", { method: "POST" });
assert.throws(() => requireIdempotencyKey(missingRequest), /Idempotency-Key is required/);
