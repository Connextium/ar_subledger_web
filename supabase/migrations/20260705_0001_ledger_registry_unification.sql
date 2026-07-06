-- Ledger registry unification
-- Consolidates buyer/supplier/facilitator workspace ledger references into public.ledgers.

alter table public.ledgers
  add column if not exists domain text;

alter table public.ledgers
  add column if not exists purpose text;

alter table public.ledgers
  add column if not exists source text;

alter table public.ledgers
  add column if not exists updated_at timestamptz not null default now();

update public.ledgers
set
  domain = coalesce(domain, 'shared'),
  purpose = coalesce(purpose, 'general'),
  source = coalesce(source, 'onchain')
where domain is null or purpose is null or source is null;

alter table public.ledgers
  alter column domain set default 'shared';

alter table public.ledgers
  alter column purpose set default 'general';

alter table public.ledgers
  alter column source set default 'onchain';

alter table public.ledgers
  alter column domain set not null;

alter table public.ledgers
  alter column purpose set not null;

alter table public.ledgers
  alter column source set not null;

alter table public.ledgers
  drop constraint if exists ledgers_domain_check;

alter table public.ledgers
  add constraint ledgers_domain_check
  check (domain in ('buyer', 'supplier', 'facilitator', 'shared'));

alter table public.ledgers
  drop constraint if exists ledgers_purpose_check;

alter table public.ledgers
  add constraint ledgers_purpose_check
  check (purpose in ('ar', 'ap', 'settlement', 'general'));

alter table public.ledgers
  drop constraint if exists ledgers_source_check;

alter table public.ledgers
  add constraint ledgers_source_check
  check (source in ('onchain', 'imported', 'manual'));

alter table public.ledgers
  drop constraint if exists ledgers_status_check;

alter table public.ledgers
  add constraint ledgers_status_check
  check (status in ('active', 'inactive', 'archived'));

create index if not exists idx_ledgers_workspace_domain_status
  on public.ledgers (workspace_id, domain, status);

create index if not exists idx_ledgers_workspace_purpose_status
  on public.ledgers (workspace_id, purpose, status);

do $$
begin
  if to_regclass('public.workspace_buyer_ledger_links') is not null then
    insert into public.ledgers (
      workspace_id,
      ledger_pda,
      ledger_code,
      authority_pubkey,
      onchain_ledger_key,
      status,
      domain,
      purpose,
      source,
      created_at,
      updated_at
    )
    select
      l.workspace_id,
      l.ledger_pda,
      coalesce(nullif(l.ledger_code, ''), l.ledger_pda),
      coalesce(nullif(l.authority_pubkey, ''), 'unknown'),
      nullif(l.accounting_ledger_key, ''),
      case when l.status in ('inactive', 'archived') then l.status else 'active' end,
      'buyer',
      'ap',
      'onchain',
      coalesce(l.created_at, now()),
      now()
    from public.workspace_buyer_ledger_links l
    where l.ledger_pda is not null
      and l.ledger_pda <> ''
    on conflict (workspace_id, ledger_pda)
    do update set
      ledger_code = coalesce(nullif(excluded.ledger_code, ''), public.ledgers.ledger_code),
      authority_pubkey = coalesce(nullif(excluded.authority_pubkey, ''), public.ledgers.authority_pubkey),
      onchain_ledger_key = coalesce(nullif(public.ledgers.onchain_ledger_key, ''), excluded.onchain_ledger_key),
      status = case
        when excluded.status in ('active', 'inactive', 'archived') then excluded.status
        else public.ledgers.status
      end,
      domain = case when public.ledgers.domain = 'shared' then 'buyer' else public.ledgers.domain end,
      purpose = case when public.ledgers.purpose = 'general' then 'ap' else public.ledgers.purpose end,
      source = coalesce(public.ledgers.source, excluded.source),
      updated_at = now();
  end if;
end
$$;
