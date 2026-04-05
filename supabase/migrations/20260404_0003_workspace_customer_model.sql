-- Phase A model foundation: recreate control-plane and customer master model.

create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'accountant', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.ledgers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  ledger_pda text not null,
  ledger_code text not null,
  authority_pubkey text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, ledger_pda),
  unique (workspace_id, ledger_code)
);

create table public.workspace_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  customer_ref text not null,
  legal_name text not null,
  tax_id text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, customer_ref),
  unique (workspace_id, id)
);

create table public.workspace_customer_code_registry (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  customer_code text not null,
  workspace_customer_id uuid not null,
  status text not null default 'reserved' check (status in ('reserved', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, customer_code),
  unique (workspace_id, workspace_customer_id),
  foreign key (workspace_id) references public.workspaces (id) on delete cascade,
  foreign key (workspace_id, workspace_customer_id)
    references public.workspace_customers (workspace_id, id)
    on delete cascade
);

create table public.workspace_customer_ledger_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  workspace_customer_id uuid not null,
  ledger_pda text not null,
  onchain_customer_pubkey text not null,
  customer_code text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id) references public.workspaces (id) on delete cascade,
  foreign key (workspace_id, workspace_customer_id)
    references public.workspace_customers (workspace_id, id)
    on delete cascade,
  foreign key (workspace_id, ledger_pda)
    references public.ledgers (workspace_id, ledger_pda)
    on delete cascade,
  foreign key (workspace_id, customer_code)
    references public.workspace_customer_code_registry (workspace_id, customer_code)
    on delete restrict,
  unique (workspace_id, onchain_customer_pubkey)
);

-- Unique active mapping per customer + ledger.
create unique index uq_workspace_customer_ledger_links_active
  on public.workspace_customer_ledger_links (workspace_customer_id, ledger_pda)
  where status = 'active';

create index idx_workspace_members_user_id on public.workspace_members (user_id);
create index idx_ledgers_workspace_id on public.ledgers (workspace_id);
create index idx_ledgers_pda on public.ledgers (ledger_pda);
create index idx_workspace_customers_workspace_id on public.workspace_customers (workspace_id);
create index idx_workspace_customers_legal_name on public.workspace_customers (workspace_id, legal_name);
create index idx_workspace_customer_registry_workspace_id on public.workspace_customer_code_registry (workspace_id);
create index idx_workspace_customer_links_workspace_id on public.workspace_customer_ledger_links (workspace_id);
create index idx_workspace_customer_links_customer_id on public.workspace_customer_ledger_links (workspace_customer_id);
create index idx_workspace_customer_links_ledger_pda on public.workspace_customer_ledger_links (ledger_pda);
