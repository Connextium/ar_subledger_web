import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve("supabase/migrations/20260621_0005_settlement_workspace_rls.sql");
assert.ok(existsSync(migrationPath), "Settlement workspace RLS migration must exist");

const migration = readFileSync(migrationPath, "utf8");
const tables = [
  "workspace_settlement_routes",
  "workspace_settlement_documents",
  "workspace_settlement_executions",
];

for (const table of tables) {
  assert.ok(
    migration.includes(`alter table public.${table} enable row level security`),
    `${table} must enable RLS`,
  );
  assert.ok(
    migration.includes(`public.is_workspace_member(${table}.workspace_id)`),
    `${table} reads must require workspace membership`,
  );
  assert.ok(
    migration.includes(`public.is_workspace_admin(${table}.workspace_id)`),
    `${table} writes must allow workspace admins`,
  );
  assert.ok(
    migration.includes(`wm.workspace_id = ${table}.workspace_id`),
    `${table} writes must scope accountant membership to the row workspace`,
  );
}
