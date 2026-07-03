import { accountingEngineService } from "@/lib/api-client/v1/accounting";

type EmbeddedWalletRef = {
  id: string;
  publicKey: string;
};

export async function assertAccountingDelegateContract(
  wallet: EmbeddedWalletRef,
  ledger: string,
  facilitator: string,
) {
  const status = await accountingEngineService.getPostingDelegateStatus(ledger, facilitator);

  status.active satisfies boolean;
  status.postingDelegatePubkey satisfies string;
  status.delegate satisfies string;

  await accountingEngineService.authorizePostingDelegate(ledger, facilitator, wallet);
  await accountingEngineService.revokePostingDelegate(ledger, facilitator, wallet);
}
