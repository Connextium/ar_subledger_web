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
