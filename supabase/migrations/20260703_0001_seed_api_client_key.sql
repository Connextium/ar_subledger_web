-- Seed one API client + key for integration testing of DB-backed auth path.
-- Raw test key (for integration environments only): ars_seedkey20260702ABC123

with target_workspace as (
  select id
  from public.workspaces
  order by created_at asc
  limit 1
)
insert into public.api_clients (
  id,
  workspace_id,
  name,
  status
)
select
  '11111111-2222-4333-8444-555555555555'::uuid,
  target_workspace.id,
  'integration-seed-client',
  'active'
from target_workspace
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  name = excluded.name,
  status = excluded.status,
  updated_at = now();

insert into public.api_client_keys (
  id,
  client_id,
  key_prefix,
  key_hash,
  status
)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'::uuid,
  '11111111-2222-4333-8444-555555555555'::uuid,
  'ars_seed',
  '1d519cd84edc949d1f673676b8dae4dfed912109cacad42c061d29d2bc43a501',
  'active'
)
on conflict (key_hash) do update
set
  client_id = excluded.client_id,
  status = excluded.status,
  revoked_at = null;

insert into public.api_client_workspace_scopes (
  id,
  client_id,
  workspace_id,
  scope
)
with target_workspace as (
  select id
  from public.workspaces
  order by created_at asc
  limit 1
)
select
  '99999999-8888-4777-8666-555555555555'::uuid,
  '11111111-2222-4333-8444-555555555555'::uuid,
  target_workspace.id,
  'workspace:*'
from target_workspace
on conflict (client_id, workspace_id, scope) do nothing;
