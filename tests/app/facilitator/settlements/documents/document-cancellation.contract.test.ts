import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(
  resolve("src/app/app/facilitator/settlements/documents/[pubkey]/page.tsx"),
  "utf8",
);

for (const expected of [
  "document.status === 1",
  "document.settledAmount === 0",
  "document.openAmount === document.originalAmount",
  "Mark Invalid / Cancel Document",
  "window.confirm",
  "service.cancelDocument({",
  "routePubkey: route.pubkey",
  "documentPubkey: document.pubkey",
  "disabled={cancelBusy}",
  "setRefreshKey((current) => current + 1)",
  "refreshKey",
]) {
  assert.ok(page.includes(expected), `document detail cancellation must include ${expected}`);
}
