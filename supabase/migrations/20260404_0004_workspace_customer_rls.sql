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
