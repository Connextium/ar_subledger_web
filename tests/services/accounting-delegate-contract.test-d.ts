import type { PublicKey } from "@solana/web3.js";
import type { EmbeddedWallet } from "@/lib/solana/embedded-wallet";
import { accountingEngineService } from "@/services/accounting-engine-service";

export async function assertAccountingDelegateContract(wallet: EmbeddedWallet, ledger: PublicKey, facilitator: PublicKey) {
  const status = await accountingEngineService.getPostingDelegateStatus(ledger, facilitator);

  status.active satisfies boolean;
  status.postingDelegatePubkey satisfies string;
  status.delegate satisfies string;

  await accountingEngineService.authorizePostingDelegate(ledger, facilitator, wallet);
  await accountingEngineService.revokePostingDelegate(ledger, facilitator, wallet);
}
