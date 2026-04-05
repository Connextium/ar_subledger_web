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
