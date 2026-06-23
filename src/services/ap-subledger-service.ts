"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Program } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey, SendTransactionError, SystemProgram, Transaction } from "@solana/web3.js";
import {
  BN,
  connection,
  createApSubledgerProgram,
} from "@/lib/solana/anchor-client";
import { ACCOUNTING_ENGINE_PROGRAM_ID } from "@/lib/solana/constants";
import {
  deriveBuyerLedgerPda,
  deriveGlAccountPda,
  deriveJournalEntryPda,
  deriveVendorInvoicePda,
  deriveVendorPaymentPda,
  deriveVendorPda,
} from "@/lib/solana/pdas";
import type { EmbeddedWallet } from "@/lib/solana/embedded-wallet";
import type {
  BuyerLedgerRecord,
  VendorInvoiceRecord,
  VendorPaymentRecord,
  VendorRecord,
} from "@/lib/types/domain";
import type {
  ApSubledgerService as ApSubledgerServiceContract,
  CreateVendorInput,
  InitializeBuyerLedgerInput,
  PayVendorInvoiceInput,
  ReceiveVendorInvoiceInput,
} from "@/services/contracts";
import { accountingEngineService } from "@/services/accounting-engine-service";

function toNumber(value: BN | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

const CONFIRMATION_WAIT_TIMEOUT_MS = 45_000;
const CONFIRMATION_POLL_INTERVAL_MS = 1_200;

export class ApSubledgerService implements ApSubledgerServiceContract {
  private readonly program: Program<Idl>;
  private readonly accountNs: any;
  private static readonly MIN_PAYER_LAMPORTS = Math.floor(0.02 * LAMPORTS_PER_SOL);

  constructor(private readonly wallet: EmbeddedWallet) {
    this.program = createApSubledgerProgram(wallet);
    this.accountNs = this.program.account as any;
  }

  private async ensureWalletFunded(minLamports = ApSubledgerService.MIN_PAYER_LAMPORTS): Promise<void> {
    const balance = await connection.getBalance(this.wallet.publicKey, "confirmed");
    if (balance >= minLamports) return;

    const signature = await connection.requestAirdrop(this.wallet.publicKey, minLamports - balance);
    await connection.confirmTransaction(signature, "confirmed");
  }

  private isDebitWithoutCreditError(error: unknown): boolean {
    if (error instanceof SendTransactionError || error instanceof Error) {
      const msg = error.message.toLowerCase();
      return msg.includes("attempt to debit an account") || msg.includes("prior credit");
    }
    return false;
  }

  private async executeWithFundingRetry<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureWalletFunded();
    try {
      return await operation();
    } catch (error) {
      if (!this.isDebitWithoutCreditError(error)) throw error;
      await this.ensureWalletFunded();
      return operation();
    }
  }

  private isAccountDecodeRangeError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes("trying to access beyond buffer length") ||
      msg.includes("out of range index") ||
      msg.includes("failed to decode")
    );
  }

  private async safeAccountAll<T>(accountName: string, fetcher: () => Promise<T[]>): Promise<T[]> {
    try {
      return await fetcher();
    } catch (error) {
      if (!this.isAccountDecodeRangeError(error)) throw error;
      console.warn(`[ApSubledgerService] Ignoring ${accountName} scan due to account decode mismatch.`, error);
      return [];
    }
  }

  private async sendAndConfirmTransaction(
    buildTransaction: () => Promise<Transaction>,
    onSubmitted?: (signature: string) => void,
  ): Promise<string> {
    const transaction = await buildTransaction();
    transaction.feePayer = this.wallet.publicKey;

    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = latestBlockhash.blockhash;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    const serializedTransaction = signedTransaction.serialize();
    let signature: string;
    try {
      signature = await connection.sendRawTransaction(serializedTransaction, {
        preflightCommitment: "confirmed",
        skipPreflight: false,
      });
    } catch (error) {
      if (error instanceof SendTransactionError) {
        let logs: string[] | undefined;
        try {
          logs = await error.getLogs(connection);
        } catch {
          logs = undefined;
        }
        const logsText = logs?.length ? ` Logs: ${JSON.stringify(logs)}` : " Logs: []";
        throw new Error(`Transaction simulation failed: ${error.message}.${logsText}`);
      }
      throw error;
    }

    onSubmitted?.(signature);

    const start = Date.now();
    while (Date.now() - start < CONFIRMATION_WAIT_TIMEOUT_MS) {
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });
      if (status.value?.err) {
        throw new Error(`Transaction ${signature} failed on-chain: ${JSON.stringify(status.value.err)}`);
      }
      if (
        status.value?.confirmationStatus === "confirmed" ||
        status.value?.confirmationStatus === "finalized"
      ) {
        return signature;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, CONFIRMATION_POLL_INTERVAL_MS);
      });
    }

    throw new Error(`Confirmation timed out after ${CONFIRMATION_WAIT_TIMEOUT_MS / 1000}s`);
  }

  private mapBuyerLedgerRecord(pubkey: string, account: any): BuyerLedgerRecord {
    return {
      pubkey,
      authority: account.authority.toBase58(),
      ledgerCode: account.ledgerCode,
      accountingLedger: account.accountingLedger.toBase58(),
      apControlAccountCode: toNumber(account.apControlAccountCode),
      purchaseAccountCode: toNumber(account.purchaseAccountCode),
      cashAccountCode: toNumber(account.cashAccountCode),
      nextJournalEntryId: toNumber(account.nextJournalEntryId),
      vendorCount: toNumber(account.vendorCount),
      invoiceCount: toNumber(account.invoiceCount),
    };
  }

  private mapVendorRecord(pubkey: string, account: any): VendorRecord {
    return {
      pubkey,
      ledger: account.ledger.toBase58(),
      vendorCode: account.vendorCode,
      vendorName: account.vendorName,
      status: account.status,
      totalOpenPayable: toNumber(account.totalOpenPayable),
      totalInvoiced: toNumber(account.totalInvoiced),
      totalPaid: toNumber(account.totalPaid),
      invoiceCount: toNumber(account.invoiceCount),
    };
  }

  private mapVendorInvoiceRecord(pubkey: string, account: any): VendorInvoiceRecord {
    return {
      pubkey,
      ledger: account.ledger.toBase58(),
      vendor: account.vendor.toBase58(),
      invoiceNo: account.invoiceNo,
      originalAmount: toNumber(account.originalAmount),
      openAmount: toNumber(account.openAmount),
      paidAmount: toNumber(account.paidAmount),
      adjustedAmount: toNumber(account.adjustedAmount),
      currency: account.currency,
      description: account.description,
      documentHash: account.documentHash,
      invoiceDate: toNumber(account.invoiceDate),
      dueDate: toNumber(account.dueDate),
      status: account.status,
      paymentSeq: toNumber(account.paymentSeq),
      journalEntryId: toNumber(account.journalEntryId),
    };
  }

  private mapVendorPaymentRecord(pubkey: string, account: any): VendorPaymentRecord {
    return {
      pubkey,
      invoice: account.invoice.toBase58(),
      paymentSeq: toNumber(account.paymentSeq),
      paymentNo: account.paymentNo,
      amount: toNumber(account.amount),
      paymentDate: toNumber(account.paymentDate),
      paymentReference: account.paymentReference,
      journalEntryId: toNumber(account.journalEntryId),
    };
  }

  private async getRequiredBuyerLedgerRecord(ledger: PublicKey): Promise<BuyerLedgerRecord> {
    const record = await this.getBuyerLedger(ledger.toBase58());
    if (!record) throw new Error(`Buyer ledger account not found: ${ledger.toBase58()}`);
    return record;
  }

  private async getPostingAccounts(ledger: BuyerLedgerRecord) {
    const accountingLedger = new PublicKey(ledger.accountingLedger);
    const accountingLedgerRecord = await accountingEngineService.getLedger(accountingLedger);
    if (!accountingLedgerRecord) {
      throw new Error(`Accounting ledger not found: ${accountingLedger.toBase58()}`);
    }

    const apNextId = BigInt(ledger.nextJournalEntryId);
    const glNextId = accountingLedgerRecord.account.journalEntryCount + 1n;
    let nextJournalEntryId = apNextId > glNextId ? apNextId : glNextId;

    for (let attempts = 0; attempts < 256; attempts += 1) {
      const [candidateJournalEntry] = deriveJournalEntryPda(accountingLedger, nextJournalEntryId);
      const existingAccount = await connection.getAccountInfo(candidateJournalEntry, "confirmed");
      if (!existingAccount) {
        const [apControlGl] = deriveGlAccountPda(accountingLedger, ledger.apControlAccountCode);
        const [purchaseGl] = deriveGlAccountPda(accountingLedger, ledger.purchaseAccountCode);
        const [cashGl] = deriveGlAccountPda(accountingLedger, ledger.cashAccountCode);

        return {
          accountingLedger,
          journalEntryId: nextJournalEntryId,
          journalEntry: candidateJournalEntry,
          apControlGl,
          purchaseGl,
          cashGl,
          accountingProgram: ACCOUNTING_ENGINE_PROGRAM_ID,
        };
      }
      nextJournalEntryId += 1n;
    }

    throw new Error(`Unable to find an unused journal entry slot for accounting ledger ${accountingLedger.toBase58()}`);
  }

  private isRetryableJournalEntryError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message;
    return (
      message.includes("JournalEntryPdaMismatch") ||
      message.includes("Allocate: account Address") ||
      message.includes("already in use")
    );
  }

  async initializeBuyerLedger(input: InitializeBuyerLedgerInput): Promise<string> {
    const [ledgerPda] = deriveBuyerLedgerPda(this.wallet.publicKey, input.ledgerCode);
    await this.executeWithFundingRetry(async () => {
      await this.program.methods
        .initializeBuyerLedger(
          input.ledgerCode,
          input.apControlAccountCode,
          input.purchaseAccountCode,
          input.cashAccountCode,
        )
        .accounts({
          authority: this.wallet.publicKey,
          ledger: ledgerPda,
          accountingLedger: new PublicKey(input.accountingLedgerPubkey),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });
    return ledgerPda.toBase58();
  }

  async createVendor(input: CreateVendorInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const [vendorPda] = deriveVendorPda(ledger, input.vendorCode);
    await this.executeWithFundingRetry(async () => {
      await this.program.methods
        .createVendor(input.vendorCode, input.vendorName)
        .accounts({
          authority: this.wallet.publicKey,
          ledger,
          vendor: vendorPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });
    return vendorPda.toBase58();
  }

  async receiveVendorInvoice(input: ReceiveVendorInvoiceInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const vendor = new PublicKey(input.vendorPubkey);
    const [invoicePda] = deriveVendorInvoicePda(ledger, input.invoiceNo);
    let buyerLedger = await this.getRequiredBuyerLedgerRecord(ledger);
    let postingAccounts = await this.getPostingAccounts(buyerLedger);

    await this.executeWithFundingRetry(async () => {
      const buildReceiveInvoiceTransaction = () =>
        this.program.methods
          .receiveVendorInvoice(
            input.invoiceNo,
            new BN(input.amountMinor),
            new BN(input.invoiceDateUnix),
            new BN(input.dueDateUnix),
            input.currency,
            input.description,
            input.documentHash,
          )
          .accounts({
            authority: this.wallet.publicKey,
            ledger,
            vendor,
            invoice: invoicePda,
            accountingLedger: postingAccounts.accountingLedger,
            journalEntry: postingAccounts.journalEntry,
            purchaseGl: postingAccounts.purchaseGl,
            apControlGl: postingAccounts.apControlGl,
            accountingProgram: postingAccounts.accountingProgram,
            systemProgram: SystemProgram.programId,
          })
          .transaction();

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await this.sendAndConfirmTransaction(buildReceiveInvoiceTransaction, input.onSubmitted);
          return;
        } catch (error) {
          if (!this.isRetryableJournalEntryError(error) || attempt === 2) {
            throw error;
          }

          buyerLedger = await this.getRequiredBuyerLedgerRecord(ledger);
          postingAccounts = await this.getPostingAccounts(buyerLedger);
        }
      }
    });

    return invoicePda.toBase58();
  }

  async payVendorInvoice(input: PayVendorInvoiceInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const vendor = new PublicKey(input.vendorPubkey);
    const invoice = new PublicKey(input.invoicePubkey);
    const [paymentPda] = deriveVendorPaymentPda(invoice, BigInt(input.paymentSeq));
    const postingAccounts = await this.getPostingAccounts(await this.getRequiredBuyerLedgerRecord(ledger));

    await this.executeWithFundingRetry(async () => {
      await this.sendAndConfirmTransaction(
        () =>
          this.program.methods
            .payVendorInvoice(
              new BN(input.paymentSeq),
              input.paymentNo,
              new BN(input.amountMinor),
              new BN(input.paymentDateUnix),
              input.paymentReference,
            )
            .accounts({
              authority: this.wallet.publicKey,
              ledger,
              vendor,
              invoice,
              payment: paymentPda,
              accountingLedger: postingAccounts.accountingLedger,
              journalEntry: postingAccounts.journalEntry,
              apControlGl: postingAccounts.apControlGl,
              cashGl: postingAccounts.cashGl,
              accountingProgram: postingAccounts.accountingProgram,
              systemProgram: SystemProgram.programId,
            })
            .transaction(),
        input.onSubmitted,
      );
    });

    return paymentPda.toBase58();
  }

  async listBuyerLedgers(): Promise<BuyerLedgerRecord[]> {
    const rows = (await this.safeAccountAll("buyerLedgerConfig", () =>
      this.accountNs.buyerLedgerConfig.all(),
    )) as any[];
    return rows.map((row) => this.mapBuyerLedgerRecord(row.publicKey.toBase58(), row.account));
  }

  async getBuyerLedger(pubkey: string): Promise<BuyerLedgerRecord | null> {
    try {
      const account = await this.accountNs.buyerLedgerConfig.fetch(new PublicKey(pubkey));
      return this.mapBuyerLedgerRecord(pubkey, account);
    } catch {
      return null;
    }
  }

  async listVendors(ledgerPubkey?: string): Promise<VendorRecord[]> {
    const rows = (await this.safeAccountAll("vendor", () => this.accountNs.vendor.all())) as any[];
    return rows
      .map((row) => this.mapVendorRecord(row.publicKey.toBase58(), row.account))
      .filter((row) => (ledgerPubkey ? row.ledger === ledgerPubkey : true));
  }

  async getVendorInvoice(pubkey: string): Promise<VendorInvoiceRecord | null> {
    try {
      const account = await this.accountNs.vendorInvoice.fetch(new PublicKey(pubkey));
      return this.mapVendorInvoiceRecord(pubkey, account);
    } catch {
      return null;
    }
  }

  async listVendorInvoices(ledgerPubkey?: string): Promise<VendorInvoiceRecord[]> {
    const rows = (await this.safeAccountAll("vendorInvoice", () =>
      this.accountNs.vendorInvoice.all(),
    )) as any[];
    return rows
      .map((row) => this.mapVendorInvoiceRecord(row.publicKey.toBase58(), row.account))
      .filter((row) => (ledgerPubkey ? row.ledger === ledgerPubkey : true));
  }

  async listVendorPayments(invoicePubkey?: string): Promise<VendorPaymentRecord[]> {
    const rows = (await this.safeAccountAll("vendorPayment", () =>
      this.accountNs.vendorPayment.all(),
    )) as any[];
    return rows
      .map((row) => this.mapVendorPaymentRecord(row.publicKey.toBase58(), row.account))
      .filter((row) => (invoicePubkey ? row.invoice === invoicePubkey : true));
  }
}

export function createApSubledgerService(wallet: EmbeddedWallet): ApSubledgerService {
  return new ApSubledgerService(wallet);
}
