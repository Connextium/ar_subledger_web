import bs58 from "bs58";
import {
  Keypair,
  PublicKey,
  SendTransactionError,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

export class EmbeddedWallet {
  constructor(private readonly keypair: Keypair) {}

  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) {
      tx.sign([this.keypair]);
      return tx;
    }
    tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }

  exportSecretKey(): string {
    return bs58.encode(this.keypair.secretKey);
  }

  static create(): EmbeddedWallet {
    return new EmbeddedWallet(Keypair.generate());
  }

  static fromSecret(secret: string): EmbeddedWallet {
    try {
      const bytes = bs58.decode(secret);
      return new EmbeddedWallet(Keypair.fromSecretKey(bytes));
    } catch (error) {
      throw new SendTransactionError({
        action: "send",
        signature: "",
        transactionMessage: "Invalid stored wallet secret",
        logs: [String(error)],
      });
    }
  }
}
