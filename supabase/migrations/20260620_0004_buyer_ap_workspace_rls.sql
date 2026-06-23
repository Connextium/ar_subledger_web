alter table public.workspace_vendors enable row level security;
alter table public.workspace_buyer_ledger_links enable row level security;
alter table public.workspace_vendor_ledger_links enable row level security;

drop policy if exists workspace_vendors_select_member on public.workspace_vendors;
drop policy if exists workspace_vendors_write_operator on public.workspace_vendors;

create policy workspace_vendors_select_member
on public.workspace_vendors
for select
using (public.is_workspace_member(workspace_vendors.workspace_id));

create policy workspace_vendors_write_operator
on public.workspace_vendors
for all
using (
  public.is_workspace_admin(workspace_vendors.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_vendors.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_vendors.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_vendors.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);
drop policy if exists workspace_buyer_ledger_links_select_member on public.workspace_buyer_ledger_links;
drop policy if exists workspace_buyer_ledger_links_write_operator on public.workspace_buyer_ledger_links;

create policy workspace_buyer_ledger_links_select_member
on public.workspace_buyer_ledger_links
for select
using (public.is_workspace_member(workspace_buyer_ledger_links.workspace_id));

create policy workspace_buyer_ledger_links_write_operator
on public.workspace_buyer_ledger_links
for all
using (
  public.is_workspace_admin(workspace_buyer_ledger_links.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_buyer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_buyer_ledger_links.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_buyer_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

drop policy if exists workspace_vendor_ledger_links_select_member on public.workspace_vendor_ledger_links;
drop policy if exists workspace_vendor_ledger_links_write_operator on public.workspace_vendor_ledger_links;

create policy workspace_vendor_ledger_links_select_member
on public.workspace_vendor_ledger_links
for select
using (public.is_workspace_member(workspace_vendor_ledger_links.workspace_id));

create policy workspace_vendor_ledger_links_write_operator
on public.workspace_vendor_ledger_links
for all
using (
  public.is_workspace_admin(workspace_vendor_ledger_links.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_vendor_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(workspace_vendor_ledger_links.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_vendor_ledger_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);
