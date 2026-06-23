alter table public.workspace_settlement_routes enable row level security;
alter table public.workspace_settlement_documents enable row level security;
alter table public.workspace_settlement_executions enable row level security;

drop policy if exists workspace_settlement_routes_select_member on public.workspace_settlement_routes;
drop policy if exists workspace_settlement_routes_write_operator on public.workspace_settlement_routes;

create policy workspace_settlement_routes_select_member
on public.workspace_settlement_routes
for select
using (public.is_workspace_member(workspace_settlement_routes.workspace_id));

create policy workspace_settlement_routes_write_operator
on public.workspace_settlement_routes
for all
using (
  public.is_workspace_admin(workspace_settlement_routes.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_settlement_routes.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_settlement_routes.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_settlement_routes.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

drop policy if exists workspace_settlement_documents_select_member on public.workspace_settlement_documents;
drop policy if exists workspace_settlement_documents_write_operator on public.workspace_settlement_documents;

create policy workspace_settlement_documents_select_member
on public.workspace_settlement_documents
for select
using (public.is_workspace_member(workspace_settlement_documents.workspace_id));

create policy workspace_settlement_documents_write_operator
on public.workspace_settlement_documents
for all
using (
  public.is_workspace_admin(workspace_settlement_documents.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_settlement_documents.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_settlement_documents.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_settlement_documents.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

drop policy if exists workspace_settlement_executions_select_member on public.workspace_settlement_executions;
drop policy if exists workspace_settlement_executions_write_operator on public.workspace_settlement_executions;

create policy workspace_settlement_executions_select_member
on public.workspace_settlement_executions
for select
using (public.is_workspace_member(workspace_settlement_executions.workspace_id));

create policy workspace_settlement_executions_write_operator
on public.workspace_settlement_executions
for all
using (
  public.is_workspace_admin(workspace_settlement_executions.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_settlement_executions.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_settlement_executions.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_settlement_executions.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);
