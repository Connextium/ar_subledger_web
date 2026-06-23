create table if not exists workspace_settlement_routes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  route_pda text not null,
  route_code text not null,
  facilitator_pubkey text not null,
  buyer_accounting_ledger text not null,
  supplier_accounting_ledger text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, route_pda),
  unique (workspace_id, route_code)
);

create table if not exists workspace_settlement_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  route_pda text not null,
  document_pda text not null,
  invoice_no text not null,
  document_hash text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, document_pda),
  unique (workspace_id, route_pda, document_hash)
);

create table if not exists workspace_settlement_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_pda text not null,
  execution_pda text not null,
  settlement_seq bigint not null,
  amount bigint not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, execution_pda),
  unique (workspace_id, document_pda, settlement_seq)
);

create index if not exists workspace_settlement_routes_workspace_idx
  on workspace_settlement_routes(workspace_id);

create index if not exists workspace_settlement_documents_workspace_idx
  on workspace_settlement_documents(workspace_id);

create index if not exists workspace_settlement_executions_workspace_idx
  on workspace_settlement_executions(workspace_id);
