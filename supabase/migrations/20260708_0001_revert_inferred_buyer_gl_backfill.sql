-- Revert inferred Base GL registry rows introduced by 20260707_0001.
-- Reason: buyer onchain_ledger_key is not guaranteed to equal a Base GL ledger_pda.

delete from public.ledgers gl
where gl.domain = 'shared'
  and gl.purpose = 'general'
  and gl.source = 'onchain'
  and gl.ledger_code = concat('GL-', gl.ledger_pda)
  and exists (
    select 1
    from public.ledgers buyer
    where buyer.workspace_id = gl.workspace_id
      and buyer.domain = 'buyer'
      and buyer.purpose = 'ap'
      and nullif(buyer.onchain_ledger_key, '') is not null
      and buyer.onchain_ledger_key = gl.ledger_pda
      and buyer.onchain_ledger_key <> buyer.ledger_pda
  );
