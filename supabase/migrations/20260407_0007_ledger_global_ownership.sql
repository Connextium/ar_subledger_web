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
