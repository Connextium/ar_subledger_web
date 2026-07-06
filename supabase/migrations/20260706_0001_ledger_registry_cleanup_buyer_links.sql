-- Ledger registry cleanup (post-stabilization)
-- Purpose: retire legacy workspace_buyer_ledger_links reads after unified registry is stable.
-- Preconditions:
--   1) API read paths use public.ledgers as primary source.
--   2) Fallback telemetry is near zero for an agreed stabilization window.
--   3) Rollback snapshot is captured.

create table if not exists public.workspace_buyer_ledger_links_archive (
  like public.workspace_buyer_ledger_links including all
);

insert into public.workspace_buyer_ledger_links_archive
select *
from public.workspace_buyer_ledger_links
on conflict do nothing;

drop policy if exists workspace_buyer_ledger_links_select_member on public.workspace_buyer_ledger_links;
drop policy if exists workspace_buyer_ledger_links_write_operator on public.workspace_buyer_ledger_links;

drop table if exists public.workspace_buyer_ledger_links;
