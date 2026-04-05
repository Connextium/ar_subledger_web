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
