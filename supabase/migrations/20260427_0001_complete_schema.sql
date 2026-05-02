-- Consolidated Supabase migration (merged from 2026-04-03 to 2026-04-07)
-- Generated to keep a single complete migration file for current module state.


-- =====================================================================
-- MERGED FROM: 20260403_0001_control_plane.sql
-- =====================================================================
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'accountant', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.ledgers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  ledger_pda text not null,
  ledger_code text not null,
  authority_pubkey text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, ledger_pda)
);

create index if not exists idx_workspace_members_user_id on public.workspace_members (user_id);
create index if not exists idx_ledgers_workspace_id on public.ledgers (workspace_id);
create index if not exists idx_ledgers_pda on public.ledgers (ledger_pda);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.ledgers enable row level security;

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
on public.workspaces
for select
using (
  workspaces.created_by = auth.uid()
  or
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner
on public.workspaces
for insert
with check (created_by = auth.uid());

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin
on public.workspaces
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

drop policy if exists workspaces_delete_admin on public.workspaces;
create policy workspaces_delete_admin
on public.workspaces
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members
for select
using (
  workspace_members.user_id = auth.uid()
);

drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin
on public.workspace_members
for insert
with check (
  workspace_members.user_id = auth.uid()
  and workspace_members.role = 'admin'
);

drop policy if exists workspace_members_insert_creator_bootstrap on public.workspace_members;
create policy workspace_members_insert_creator_bootstrap
on public.workspace_members
for insert
with check (
  user_id = auth.uid()
  and role = 'admin'
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.created_by = auth.uid()
  )
);

drop policy if exists workspace_members_update_admin on public.workspace_members;
create policy workspace_members_update_admin
on public.workspace_members
for update
using (
  workspace_members.user_id = auth.uid()
)
with check (
  workspace_members.user_id = auth.uid()
);

drop policy if exists workspace_members_delete_admin on public.workspace_members;
create policy workspace_members_delete_admin
on public.workspace_members
for delete
using (
  workspace_members.user_id = auth.uid()
);

drop policy if exists ledgers_select_member on public.ledgers;
create policy ledgers_select_member
on public.ledgers
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists ledgers_insert_admin on public.ledgers;
create policy ledgers_insert_admin
on public.ledgers
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

drop policy if exists ledgers_update_admin on public.ledgers;
create policy ledgers_update_admin
on public.ledgers
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

drop policy if exists ledgers_delete_admin on public.ledgers;
create policy ledgers_delete_admin
on public.ledgers
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);


-- =====================================================================
-- MERGED FROM: 20260404_0002_control_plane_reset.sql
-- =====================================================================
-- Reset tables in dependency order.
-- Use CASCADE so table-bound policies, indexes, and constraints are removed safely.
drop table if exists public.workspace_customer_ledger_links cascade;
drop table if exists public.workspace_customer_code_registry cascade;
drop table if exists public.workspace_customers cascade;
drop table if exists public.ledgers cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;


-- =====================================================================
-- MERGED FROM: 20260404_0003_workspace_customer_model.sql
-- =====================================================================
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


-- =====================================================================
-- MERGED FROM: 20260404_0004_workspace_customer_rls.sql
-- =====================================================================
-- Phase A RLS: recreate policies for reset-first model.

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.ledgers enable row level security;
alter table public.workspace_customers enable row level security;
alter table public.workspace_customer_code_registry enable row level security;
alter table public.workspace_customer_ledger_links enable row level security;

-- Workspace policies.
create policy workspaces_select_member
on public.workspaces
for select
using (
  workspaces.created_by = auth.uid()
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
);

create policy workspaces_insert_owner
on public.workspaces
for insert
with check (created_by = auth.uid());

create policy workspaces_update_admin
on public.workspaces
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

create policy workspaces_delete_admin
on public.workspaces
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

-- Workspace member policies.
create policy workspace_members_select_member
on public.workspace_members
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy workspace_members_insert_admin
on public.workspace_members
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

create policy workspace_members_insert_creator_bootstrap
on public.workspace_members
for insert
with check (
  workspace_members.user_id = auth.uid()
  and workspace_members.role = 'admin'
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.created_by = auth.uid()
  )
);

create policy workspace_members_update_admin
on public.workspace_members
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

create policy workspace_members_delete_admin
on public.workspace_members
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

-- Ledger policies.
create policy ledgers_select_member
on public.ledgers
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy ledgers_insert_admin
on public.ledgers
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

create policy ledgers_update_admin
on public.ledgers
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

create policy ledgers_delete_admin
on public.ledgers
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ledgers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  )
);

-- Customer master policies.
create policy workspace_customers_select_member
on public.workspace_customers
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy workspace_customers_insert_operator
on public.workspace_customers
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);

create policy workspace_customers_update_operator
on public.workspace_customers
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);

create policy workspace_customers_delete_operator
on public.workspace_customers
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);

-- Customer code registry policies.
create policy workspace_customer_code_registry_select_member
on public.workspace_customer_code_registry
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy workspace_customer_code_registry_insert_operator
on public.workspace_customer_code_registry
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);

create policy workspace_customer_code_registry_update_operator
on public.workspace_customer_code_registry
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);

create policy workspace_customer_code_registry_delete_operator
on public.workspace_customer_code_registry
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);

-- Customer-ledger link policies.
create policy workspace_customer_ledger_links_select_member
on public.workspace_customer_ledger_links
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy workspace_customer_ledger_links_insert_operator
on public.workspace_customer_ledger_links
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);

create policy workspace_customer_ledger_links_update_operator
on public.workspace_customer_ledger_links
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);

create policy workspace_customer_ledger_links_delete_operator
on public.workspace_customer_ledger_links
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('admin', 'accountant')
  )
);


-- =====================================================================
-- MERGED FROM: 20260404_0005_workspace_rls_recursion_fix.sql
-- =====================================================================
-- Phase G hotfix: resolve infinite recursion in workspace_members policies.
-- Strategy: use SECURITY DEFINER helpers so policies do not recursively query RLS-protected tables.

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

-- Drop policies that can recurse and recreate them using helper functions.
drop policy if exists workspaces_select_member on public.workspaces;
drop policy if exists workspaces_insert_owner on public.workspaces;
drop policy if exists workspaces_update_admin on public.workspaces;
drop policy if exists workspaces_delete_admin on public.workspaces;

drop policy if exists workspace_members_select_member on public.workspace_members;
drop policy if exists workspace_members_insert_admin on public.workspace_members;
drop policy if exists workspace_members_insert_creator_bootstrap on public.workspace_members;
drop policy if exists workspace_members_update_admin on public.workspace_members;
drop policy if exists workspace_members_delete_admin on public.workspace_members;

drop policy if exists ledgers_select_member on public.ledgers;
drop policy if exists ledgers_insert_admin on public.ledgers;
drop policy if exists ledgers_update_admin on public.ledgers;
drop policy if exists ledgers_delete_admin on public.ledgers;

drop policy if exists workspace_customers_select_member on public.workspace_customers;
drop policy if exists workspace_customers_insert_operator on public.workspace_customers;
drop policy if exists workspace_customers_update_operator on public.workspace_customers;
drop policy if exists workspace_customers_delete_operator on public.workspace_customers;

drop policy if exists workspace_customer_code_registry_select_member on public.workspace_customer_code_registry;
drop policy if exists workspace_customer_code_registry_insert_operator on public.workspace_customer_code_registry;
drop policy if exists workspace_customer_code_registry_update_operator on public.workspace_customer_code_registry;
drop policy if exists workspace_customer_code_registry_delete_operator on public.workspace_customer_code_registry;

drop policy if exists workspace_customer_ledger_links_select_member on public.workspace_customer_ledger_links;
drop policy if exists workspace_customer_ledger_links_insert_operator on public.workspace_customer_ledger_links;
drop policy if exists workspace_customer_ledger_links_update_operator on public.workspace_customer_ledger_links;
drop policy if exists workspace_customer_ledger_links_delete_operator on public.workspace_customer_ledger_links;

-- Workspace policies.
create policy workspaces_select_member
on public.workspaces
for select
using (
  workspaces.created_by = auth.uid()
  or public.is_workspace_member(workspaces.id)
);

create policy workspaces_insert_owner
on public.workspaces
for insert
with check (created_by = auth.uid());

create policy workspaces_update_admin
on public.workspaces
for update
using (
  workspaces.created_by = auth.uid()
  or public.is_workspace_admin(workspaces.id)
)
with check (
  workspaces.created_by = auth.uid()
  or public.is_workspace_admin(workspaces.id)
);

create policy workspaces_delete_admin
on public.workspaces
for delete
using (
  workspaces.created_by = auth.uid()
  or public.is_workspace_admin(workspaces.id)
);

-- Workspace member policies.
create policy workspace_members_select_member
on public.workspace_members
for select
using (
  workspace_members.user_id = auth.uid()
  or public.is_workspace_admin(workspace_members.workspace_id)
  or exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.created_by = auth.uid()
  )
);

create policy workspace_members_insert_admin
on public.workspace_members
for insert
with check (
  public.is_workspace_admin(workspace_members.workspace_id)
);

create policy workspace_members_insert_creator_bootstrap
on public.workspace_members
for insert
with check (
  workspace_members.user_id = auth.uid()
  and workspace_members.role = 'admin'
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.created_by = auth.uid()
  )
);

create policy workspace_members_update_admin
on public.workspace_members
for update
using (
  public.is_workspace_admin(workspace_members.workspace_id)
)
with check (
  public.is_workspace_admin(workspace_members.workspace_id)
);

create policy workspace_members_delete_admin
on public.workspace_members
for delete
using (
  public.is_workspace_admin(workspace_members.workspace_id)
);

-- Ledger policies.
create policy ledgers_select_member
on public.ledgers
for select
using (public.is_workspace_member(ledgers.workspace_id));

create policy ledgers_insert_admin
on public.ledgers
for insert
with check (public.is_workspace_admin(ledgers.workspace_id));

create policy ledgers_update_admin
on public.ledgers
for update
using (public.is_workspace_admin(ledgers.workspace_id))
with check (public.is_workspace_admin(ledgers.workspace_id));

create policy ledgers_delete_admin
on public.ledgers
for delete
using (public.is_workspace_admin(ledgers.workspace_id));

-- Customer master policies.
create policy workspace_customers_select_member
on public.workspace_customers
for select
using (public.is_workspace_member(workspace_customers.workspace_id));

create policy workspace_customers_insert_operator
on public.workspace_customers
for insert
with check (
  public.is_workspace_admin(workspace_customers.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

create policy workspace_customers_update_operator
on public.workspace_customers
for update
using (
  public.is_workspace_admin(workspace_customers.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_customers.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

create policy workspace_customers_delete_operator
on public.workspace_customers
for delete
using (
  public.is_workspace_admin(workspace_customers.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

-- Customer code registry policies.
create policy workspace_customer_code_registry_select_member
on public.workspace_customer_code_registry
for select
using (public.is_workspace_member(workspace_customer_code_registry.workspace_id));

create policy workspace_customer_code_registry_insert_operator
on public.workspace_customer_code_registry
for insert
with check (
  public.is_workspace_admin(workspace_customer_code_registry.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

create policy workspace_customer_code_registry_update_operator
on public.workspace_customer_code_registry
for update
using (
  public.is_workspace_admin(workspace_customer_code_registry.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_customer_code_registry.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

create policy workspace_customer_code_registry_delete_operator
on public.workspace_customer_code_registry
for delete
using (
  public.is_workspace_admin(workspace_customer_code_registry.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_code_registry.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

-- Customer-ledger link policies.
create policy workspace_customer_ledger_links_select_member
on public.workspace_customer_ledger_links
for select
using (public.is_workspace_member(workspace_customer_ledger_links.workspace_id));

create policy workspace_customer_ledger_links_insert_operator
on public.workspace_customer_ledger_links
for insert
with check (
  public.is_workspace_admin(workspace_customer_ledger_links.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

create policy workspace_customer_ledger_links_update_operator
on public.workspace_customer_ledger_links
for update
using (
  public.is_workspace_admin(workspace_customer_ledger_links.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_customer_ledger_links.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

create policy workspace_customer_ledger_links_delete_operator
on public.workspace_customer_ledger_links
for delete
using (
  public.is_workspace_admin(workspace_customer_ledger_links.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_customer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);


-- =====================================================================
-- MERGED FROM: 20260404_0006_ledger_disable_status.sql
-- =====================================================================
-- Add soft-disable support for workspace ledger links.
-- Allow multiple rows with same ledger_code, but only one active per workspace/code.

alter table public.ledgers
  add column if not exists status text not null default 'active'
  check (status in ('active', 'inactive'));

alter table public.ledgers
  drop constraint if exists ledgers_workspace_id_ledger_code_key;

drop index if exists uq_ledgers_workspace_ledger_code_active;
create unique index uq_ledgers_workspace_ledger_code_active
  on public.ledgers (workspace_id, ledger_code)
  where status = 'active';


-- =====================================================================
-- MERGED FROM: 20260405_0007_wallet_management_phase_a.sql
-- =====================================================================
-- Phase A: Wallet management foundation (workspace-owned).
-- Scope for this stage:
--   - wallet_keypairs
--   - wallet_balance_snapshots
-- Out of scope for this stage:
--   - wallet_usage_events
--   - archive workflow

create table if not exists public.wallet_keypairs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chain text not null default 'solana',
  public_key text not null,
  encrypted_private_key text not null,
  key_provider text not null default 'app_managed'
    check (key_provider in ('app_managed', 'db_vault', 'aws_kms', 'gcp_kms', 'azure_kv')),
  encryption_key_id text not null,
  key_version text not null default 'v1',
  encrypted_dek text,
  crypto_alg text not null default 'AES-256-GCM',
  nonce_or_iv text not null,
  auth_tag text,
  source text not null
    check (source in ('registration_init', 'rotate', 'function_generated')),
  usage text not null
    check (
      usage in (
        'main_operational',
        'registration_seed',
        'transaction_signer',
        'workspace_bootstrap',
        'ledger_initialize',
        'customer_initialize',
        'invoice_issue',
        'settlement_record',
        'emergency_fallback'
      )
    ),
  reference_type text,
  reference_id text,
  is_main boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'disabled', 'archived')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, chain, public_key),
  check (
    (reference_type is null and reference_id is null)
    or
    (reference_type is not null and reference_id is not null)
  )
);

create table if not exists public.wallet_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallet_keypairs (id) on delete cascade,
  lamports bigint not null check (lamports >= 0),
  rpc_endpoint text not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One active main wallet per workspace + chain.
drop index if exists uq_wallet_keypairs_main_active;
create unique index uq_wallet_keypairs_main_active
  on public.wallet_keypairs (workspace_id, chain)
  where is_main = true and status = 'active';

create index if not exists idx_wallet_keypairs_workspace_status
  on public.wallet_keypairs (workspace_id, status);
create index if not exists idx_wallet_keypairs_workspace_usage
  on public.wallet_keypairs (workspace_id, usage);
create index if not exists idx_wallet_keypairs_reference
  on public.wallet_keypairs (reference_type, reference_id);
create index if not exists idx_wallet_keypairs_public_key
  on public.wallet_keypairs (public_key);
create index if not exists idx_wallet_balance_snapshots_wallet_observed
  on public.wallet_balance_snapshots (wallet_id, observed_at desc);

alter table public.wallet_keypairs enable row level security;
alter table public.wallet_balance_snapshots enable row level security;

-- wallet_keypairs policies
-- Read by workspace members.
drop policy if exists wallet_keypairs_select_member on public.wallet_keypairs;
create policy wallet_keypairs_select_member
on public.wallet_keypairs
for select
using (public.is_workspace_member(wallet_keypairs.workspace_id));

-- Write by workspace admins/accountants.
drop policy if exists wallet_keypairs_insert_operator on public.wallet_keypairs;
create policy wallet_keypairs_insert_operator
on public.wallet_keypairs
for insert
with check (
  wallet_keypairs.created_by = auth.uid()
  and (
    public.is_workspace_admin(wallet_keypairs.workspace_id)
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = wallet_keypairs.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'accountant'
    )
  )
);

drop policy if exists wallet_keypairs_update_operator on public.wallet_keypairs;
create policy wallet_keypairs_update_operator
on public.wallet_keypairs
for update
using (
  public.is_workspace_admin(wallet_keypairs.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = wallet_keypairs.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(wallet_keypairs.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = wallet_keypairs.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

-- Delete stays admin-only even though archive workflow is out of scope.
drop policy if exists wallet_keypairs_delete_admin on public.wallet_keypairs;
create policy wallet_keypairs_delete_admin
on public.wallet_keypairs
for delete
using (public.is_workspace_admin(wallet_keypairs.workspace_id));

-- wallet_balance_snapshots policies
-- Read by workspace members via wallet ownership.
drop policy if exists wallet_balance_snapshots_select_member on public.wallet_balance_snapshots;
create policy wallet_balance_snapshots_select_member
on public.wallet_balance_snapshots
for select
using (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and public.is_workspace_member(wk.workspace_id)
  )
);

-- Write by workspace admins/accountants via wallet ownership.
drop policy if exists wallet_balance_snapshots_insert_operator on public.wallet_balance_snapshots;
create policy wallet_balance_snapshots_insert_operator
on public.wallet_balance_snapshots
for insert
with check (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and (
        public.is_workspace_admin(wk.workspace_id)
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = wk.workspace_id
            and wm.user_id = auth.uid()
            and wm.role = 'accountant'
        )
      )
  )
);

drop policy if exists wallet_balance_snapshots_update_operator on public.wallet_balance_snapshots;
create policy wallet_balance_snapshots_update_operator
on public.wallet_balance_snapshots
for update
using (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and (
        public.is_workspace_admin(wk.workspace_id)
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = wk.workspace_id
            and wm.user_id = auth.uid()
            and wm.role = 'accountant'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and (
        public.is_workspace_admin(wk.workspace_id)
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = wk.workspace_id
            and wm.user_id = auth.uid()
            and wm.role = 'accountant'
        )
      )
  )
);

drop policy if exists wallet_balance_snapshots_delete_admin on public.wallet_balance_snapshots;
create policy wallet_balance_snapshots_delete_admin
on public.wallet_balance_snapshots
for delete
using (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and public.is_workspace_admin(wk.workspace_id)
  )
);


-- =====================================================================
-- MERGED FROM: 20260407_0007_ledger_global_ownership.sql
-- =====================================================================
-- Enforce one-ledger-per-workspace ownership globally.
-- A ledger PDA must not be attached to more than one workspace.

-- Guard: fail migration if duplicates already exist.
do $$
begin
  if exists (
    select 1
    from public.ledgers
    group by ledger_pda
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce global ledger ownership: duplicate ledger_pda rows exist in public.ledgers';
  end if;
end $$;

-- Add global uniqueness for ledger identity.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ledgers_ledger_pda_unique'
      and conrelid = 'public.ledgers'::regclass
  ) then
    alter table public.ledgers
      add constraint ledgers_ledger_pda_unique unique (ledger_pda);
  end if;
end $$;


-- =====================================================================
-- MERGED FROM: 20260407_0008_workspace_ledger_code_unique.sql
-- =====================================================================
-- Enforce strict ledger_code uniqueness per workspace (case-insensitive).
-- This supersedes the prior active-only uniqueness index.

-- Normalize existing codes first.
update public.ledgers
set ledger_code = upper(trim(ledger_code));

-- Guard: fail migration if duplicates still exist after normalization.
do $$
begin
  if exists (
    select 1
    from public.ledgers
    group by workspace_id, lower(trim(ledger_code))
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce workspace ledger_code uniqueness: duplicate ledger_code values exist within a workspace';
  end if;
end $$;

-- Remove legacy active-only uniqueness (if present).
drop index if exists uq_ledgers_workspace_ledger_code_active;

-- Remove old table-level unique constraint if present from older baseline migration.
alter table public.ledgers
  drop constraint if exists ledgers_workspace_id_ledger_code_key;

-- Enforce one code per workspace regardless of status, case-insensitive.
create unique index if not exists uq_ledgers_workspace_ledger_code_unique
  on public.ledgers (workspace_id, lower(trim(ledger_code)));


-- =====================================================================
-- Accounting Engine Integration: Journal Entry Posting Lines
-- =====================================================================
-- Store posting lines for journal entries to enable querying and audit trails.
-- Posting lines are created when journal entries are posted on-chain via the accounting engine.

create table if not exists public.journal_entry_posting_lines (
  id bigserial primary key,
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  entry_id bigint not null,
  account_code integer not null,
  amount bigint not null check (amount >= 0),
  is_debit boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for efficient querying
create index if not exists idx_posting_lines_ledger_entry 
  on public.journal_entry_posting_lines (ledger_id, entry_id);
create index if not exists idx_posting_lines_account 
  on public.journal_entry_posting_lines (ledger_id, account_code);
create index if not exists idx_posting_lines_created_at 
  on public.journal_entry_posting_lines (ledger_id, created_at desc);

-- Enable RLS
alter table public.journal_entry_posting_lines enable row level security;

-- RLS Policies: Users can view posting lines for ledgers in their workspace
drop policy if exists journal_entry_posting_lines_select_member on public.journal_entry_posting_lines;
create policy journal_entry_posting_lines_select_member
  on public.journal_entry_posting_lines
  for select
  using (
    exists (
      select 1
      from public.ledgers l
      where l.id = journal_entry_posting_lines.ledger_id
        and public.is_workspace_member(l.workspace_id)
    )
  );

-- RLS Policies: Accountants and admins can insert posting lines
drop policy if exists journal_entry_posting_lines_insert_operator on public.journal_entry_posting_lines;
create policy journal_entry_posting_lines_insert_operator
  on public.journal_entry_posting_lines
  for insert
  with check (
    exists (
      select 1
      from public.ledgers l
      where l.id = journal_entry_posting_lines.ledger_id
        and (
          public.is_workspace_admin(l.workspace_id)
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = l.workspace_id
              and wm.user_id = auth.uid()
              and wm.role = 'accountant'
          )
        )
    )
  );

-- RLS Policies: Admins can update posting lines
drop policy if exists journal_entry_posting_lines_update_admin on public.journal_entry_posting_lines;
create policy journal_entry_posting_lines_update_admin
  on public.journal_entry_posting_lines
  for update
  using (
    exists (
      select 1
      from public.ledgers l
      where l.id = journal_entry_posting_lines.ledger_id
        and public.is_workspace_admin(l.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.ledgers l
      where l.id = journal_entry_posting_lines.ledger_id
        and public.is_workspace_admin(l.workspace_id)
    )
  );

-- RLS Policies: Admins can delete posting lines
drop policy if exists journal_entry_posting_lines_delete_admin on public.journal_entry_posting_lines;
create policy journal_entry_posting_lines_delete_admin
  on public.journal_entry_posting_lines
  for delete
  using (
    exists (
      select 1
      from public.ledgers l
      where l.id = journal_entry_posting_lines.ledger_id
        and public.is_workspace_admin(l.workspace_id)
    )
  );


-- =====================================================================
-- GL Accounts Initialization Flag
-- =====================================================================
-- Track whether GL accounts have been initialized for a ledger

alter table public.ledgers
  add column if not exists gl_accounts_initialized boolean not null default false;
alter table public.ledgers
  add column if not exists onchain_ledger_key text;

ALTER TABLE ledgers
ADD COLUMN updated_at timestamp with time zone DEFAULT now();

-- Optional: Automatically update on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ledgers_updated_at ON ledgers;
CREATE TRIGGER update_ledgers_updated_at
BEFORE UPDATE ON ledgers
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();