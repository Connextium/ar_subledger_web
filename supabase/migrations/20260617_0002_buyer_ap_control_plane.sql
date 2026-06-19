create table if not exists workspace_vendors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  vendor_ref text not null,
  legal_name text not null,
  tax_id text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, vendor_ref)
);

create table if not exists workspace_buyer_ledger_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ledger_pda text not null,
  ledger_code text not null,
  authority_pubkey text not null,
  accounting_ledger_key text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (workspace_id, ledger_pda)
);

create table if not exists workspace_vendor_ledger_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  workspace_vendor_id uuid not null references workspace_vendors(id) on delete cascade,
  ledger_pda text not null,
  onchain_vendor_pubkey text not null,
  vendor_code text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, ledger_pda, workspace_vendor_id)
);
