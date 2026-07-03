-- Phase 2 Task 5: API key auth and audit persistence tables

create extension if not exists pgcrypto;

create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_client_keys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.api_clients (id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.api_client_workspace_scopes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.api_clients (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  scope text not null,
  created_at timestamptz not null default now(),
  unique (client_id, workspace_id, scope)
);

create table if not exists public.api_audit_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  action text not null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  actor_type text not null check (actor_type in ('api_key', 'bearer', 'system')),
  actor_id text,
  status_code integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_clients_workspace_id on public.api_clients (workspace_id);
create index if not exists idx_api_client_keys_client_id on public.api_client_keys (client_id);
create index if not exists idx_api_client_workspace_scopes_workspace on public.api_client_workspace_scopes (workspace_id, client_id);
create index if not exists idx_api_audit_events_workspace_id on public.api_audit_events (workspace_id, created_at desc);
create index if not exists idx_api_audit_events_request_id on public.api_audit_events (request_id);
