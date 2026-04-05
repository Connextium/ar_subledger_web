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
