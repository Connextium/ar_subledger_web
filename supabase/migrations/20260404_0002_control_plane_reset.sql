-- Reset tables in dependency order.
-- Use CASCADE so table-bound policies, indexes, and constraints are removed safely.
drop table if exists public.workspace_customer_ledger_links cascade;
drop table if exists public.workspace_customer_code_registry cascade;
drop table if exists public.workspace_customers cascade;
drop table if exists public.ledgers cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
