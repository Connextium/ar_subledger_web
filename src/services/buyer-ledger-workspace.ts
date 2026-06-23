import type {
  BuyerLedgerRecord,
  WorkspaceBuyerLedgerLink,
  WorkspaceLedgerLink,
} from "@/lib/types/domain";

export function filterBuyerLedgersByWorkspaceLinks(
  ledgers: BuyerLedgerRecord[],
  links: WorkspaceBuyerLedgerLink[],
  workspaceLedgerLinks: WorkspaceLedgerLink[] = [],
): BuyerLedgerRecord[] {
  const linksByLedgerPda = new Map(links.map((link) => [link.ledgerPda, link]));
  const activeAccountingLedgerKeys = new Set(
    workspaceLedgerLinks
      .filter((link) => link.status === "active" && link.onchainLedgerKey)
      .map((link) => link.onchainLedgerKey as string),
  );

  return ledgers.filter((ledger) => {
    const directLink = linksByLedgerPda.get(ledger.pubkey);
    if (directLink) return directLink.status === "active";
    return activeAccountingLedgerKeys.has(ledger.accountingLedger);
  });
}
