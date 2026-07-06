-- Backfill Base GL registry rows for buyer-ledger links.
-- Some historical buyer AP rows reference onchain_ledger_key but do not have
-- a corresponding Base GL row in public.ledgers.

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
  l.onchain_ledger_key,
  concat('GL-', l.onchain_ledger_key),
  l.authority_pubkey,
  l.onchain_ledger_key,
  case when l.status in ('inactive', 'archived') then l.status else 'active' end,
  'shared',
  'general',
  'onchain',
  coalesce(l.created_at, now()),
  now()
from public.ledgers l
where l.domain = 'buyer'
  and l.purpose = 'ap'
  and nullif(l.onchain_ledger_key, '') is not null
  and l.onchain_ledger_key <> l.ledger_pda
on conflict (workspace_id, ledger_pda) do nothing;
