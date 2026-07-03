type BuyerLedgerLike = {
	pubkey?: string;
	ledgerPubkey?: string;
};

type BuyerLedgerLinkLike = {
	buyerLedgerPubkey?: string;
	ledgerPubkey?: string;
	ledgerPda?: string;
	status?: string;
};

export function filterBuyerLedgersByWorkspaceLinks(
	buyerLedgers: any[],
	links: BuyerLedgerLinkLike[],
	_workspaceLedgerLinks?: unknown[],
): any[] {
	const active = new Set(
		links
			.filter((link) => !link.status || link.status === "active")
			  .map((link) => link.buyerLedgerPubkey ?? link.ledgerPubkey ?? link.ledgerPda)
			.filter((value): value is string => Boolean(value)),
	);

	return buyerLedgers.filter((ledger: BuyerLedgerLike) => {
		const key = ledger.pubkey ?? ledger.ledgerPubkey;
		return !!key && active.has(key);
	});
}
