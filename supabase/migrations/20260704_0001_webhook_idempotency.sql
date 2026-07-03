-- Task 5 completion: idempotency and webhook persistence ownership tables.

create extension if not exists pgcrypto;

create table if not exists public.api_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  idempotency_key text not null,
  request_id text not null,
  action text not null,
  actor_type text not null check (actor_type in ('api_key', 'bearer', 'system')),
  actor_id text,
  status_code integer,
  response_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_type text not null default '*',
  target_url text not null,
  signing_secret text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subscription_id uuid not null references public.webhook_subscriptions (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_api_idempotency_workspace_key
  on public.api_idempotency_records (workspace_id, idempotency_key);

create index if not exists idx_webhook_subscriptions_workspace
  on public.webhook_subscriptions (workspace_id, status);

create index if not exists idx_webhook_delivery_attempts_pending
  on public.webhook_delivery_attempts (workspace_id, status, next_attempt_at);
