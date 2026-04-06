-- Phase A: Wallet management foundation (workspace-owned).
-- Scope for this stage:
--   - wallet_keypairs
--   - wallet_balance_snapshots
-- Out of scope for this stage:
--   - wallet_usage_events
--   - archive workflow

create table if not exists public.wallet_keypairs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chain text not null default 'solana',
  public_key text not null,
  encrypted_private_key text not null,
  key_provider text not null default 'app_managed'
    check (key_provider in ('app_managed', 'db_vault', 'aws_kms', 'gcp_kms', 'azure_kv')),
  encryption_key_id text not null,
  key_version text not null default 'v1',
  encrypted_dek text,
  crypto_alg text not null default 'AES-256-GCM',
  nonce_or_iv text not null,
  auth_tag text,
  source text not null
    check (source in ('registration_init', 'rotate', 'function_generated')),
  usage text not null
    check (
      usage in (
        'main_operational',
        'registration_seed',
        'transaction_signer',
        'workspace_bootstrap',
        'ledger_initialize',
        'customer_initialize',
        'invoice_issue',
        'settlement_record',
        'emergency_fallback'
      )
    ),
  reference_type text,
  reference_id text,
  is_main boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'disabled', 'archived')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, chain, public_key),
  check (
    (reference_type is null and reference_id is null)
    or
    (reference_type is not null and reference_id is not null)
  )
);

create table if not exists public.wallet_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallet_keypairs (id) on delete cascade,
  lamports bigint not null check (lamports >= 0),
  rpc_endpoint text not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One active main wallet per workspace + chain.
drop index if exists uq_wallet_keypairs_main_active;
create unique index uq_wallet_keypairs_main_active
  on public.wallet_keypairs (workspace_id, chain)
  where is_main = true and status = 'active';

create index if not exists idx_wallet_keypairs_workspace_status
  on public.wallet_keypairs (workspace_id, status);
create index if not exists idx_wallet_keypairs_workspace_usage
  on public.wallet_keypairs (workspace_id, usage);
create index if not exists idx_wallet_keypairs_reference
  on public.wallet_keypairs (reference_type, reference_id);
create index if not exists idx_wallet_keypairs_public_key
  on public.wallet_keypairs (public_key);
create index if not exists idx_wallet_balance_snapshots_wallet_observed
  on public.wallet_balance_snapshots (wallet_id, observed_at desc);

alter table public.wallet_keypairs enable row level security;
alter table public.wallet_balance_snapshots enable row level security;

-- wallet_keypairs policies
-- Read by workspace members.
drop policy if exists wallet_keypairs_select_member on public.wallet_keypairs;
create policy wallet_keypairs_select_member
on public.wallet_keypairs
for select
using (public.is_workspace_member(wallet_keypairs.workspace_id));

-- Write by workspace admins/accountants.
drop policy if exists wallet_keypairs_insert_operator on public.wallet_keypairs;
create policy wallet_keypairs_insert_operator
on public.wallet_keypairs
for insert
with check (
  wallet_keypairs.created_by = auth.uid()
  and (
    public.is_workspace_admin(wallet_keypairs.workspace_id)
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = wallet_keypairs.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'accountant'
    )
  )
);

drop policy if exists wallet_keypairs_update_operator on public.wallet_keypairs;
create policy wallet_keypairs_update_operator
on public.wallet_keypairs
for update
using (
  public.is_workspace_admin(wallet_keypairs.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = wallet_keypairs.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
)
with check (
  public.is_workspace_admin(wallet_keypairs.workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = wallet_keypairs.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'accountant'
  )
);

-- Delete stays admin-only even though archive workflow is out of scope.
drop policy if exists wallet_keypairs_delete_admin on public.wallet_keypairs;
create policy wallet_keypairs_delete_admin
on public.wallet_keypairs
for delete
using (public.is_workspace_admin(wallet_keypairs.workspace_id));

-- wallet_balance_snapshots policies
-- Read by workspace members via wallet ownership.
drop policy if exists wallet_balance_snapshots_select_member on public.wallet_balance_snapshots;
create policy wallet_balance_snapshots_select_member
on public.wallet_balance_snapshots
for select
using (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and public.is_workspace_member(wk.workspace_id)
  )
);

-- Write by workspace admins/accountants via wallet ownership.
drop policy if exists wallet_balance_snapshots_insert_operator on public.wallet_balance_snapshots;
create policy wallet_balance_snapshots_insert_operator
on public.wallet_balance_snapshots
for insert
with check (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and (
        public.is_workspace_admin(wk.workspace_id)
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = wk.workspace_id
            and wm.user_id = auth.uid()
            and wm.role = 'accountant'
        )
      )
  )
);

drop policy if exists wallet_balance_snapshots_update_operator on public.wallet_balance_snapshots;
create policy wallet_balance_snapshots_update_operator
on public.wallet_balance_snapshots
for update
using (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and (
        public.is_workspace_admin(wk.workspace_id)
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = wk.workspace_id
            and wm.user_id = auth.uid()
            and wm.role = 'accountant'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and (
        public.is_workspace_admin(wk.workspace_id)
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = wk.workspace_id
            and wm.user_id = auth.uid()
            and wm.role = 'accountant'
        )
      )
  )
);

drop policy if exists wallet_balance_snapshots_delete_admin on public.wallet_balance_snapshots;
create policy wallet_balance_snapshots_delete_admin
on public.wallet_balance_snapshots
for delete
using (
  exists (
    select 1
    from public.wallet_keypairs wk
    where wk.id = wallet_balance_snapshots.wallet_id
      and public.is_workspace_admin(wk.workspace_id)
  )
);
