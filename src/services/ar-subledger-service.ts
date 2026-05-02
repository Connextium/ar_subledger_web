"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import bs58 from "bs58";
import type { Program } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey, SendTransactionError, SystemProgram, Transaction } from "@solana/web3.js";
import type { Idl } from "@coral-xyz/anchor";
import { BN, connection, createArSubledgerProgram } from "@/lib/solana/anchor-client";
import { ACCOUNTING_ENGINE_PROGRAM_ID } from "@/lib/solana/constants";
import {
  deriveCreditPda,
  deriveCustomerPda,
  deriveGlAccountPda,
  deriveInvoicePda,
  deriveJournalEntryPda,
  deriveLedgerPda,
  deriveReceiptPda,
  deriveWriteOffPda,
} from "@/lib/solana/pdas";
import type {
  ActivityItem,
  CreditNoteRecord,
  CustomerRecord,
  InvoiceRecord,
  LedgerRecord,
  ReceiptRecord,
  WriteOffRecord,
} from "@/lib/types/domain";
import type {
  CloseInvoiceInput,
  CreateCustomerInput,
  CustomerService,
  InitializeLedgerInput,
  InvoiceService,
  IssueCreditNoteInput,
  IssueInvoiceInput,
  LedgerService,
  RecordReceiptInput,
  SettlementService,
  UpdateCustomerInput,
  WriteOffInvoiceInput,
} from "@/services/contracts";
import type { EmbeddedWallet } from "@/lib/solana/embedded-wallet";

function toNumber(value: BN | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

function encodeMemcmpBytes(bytes: Uint8Array): string {
  return bs58.encode(Buffer.from(bytes));
}

const CONFIRMATION_WAIT_TIMEOUT_MS = 45_000;
const CONFIRMATION_POLL_INTERVAL_MS = 1_200;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const REBROADCAST_INTERVAL_MS = readPositiveIntEnv(
  "NEXT_PUBLIC_SOLANA_REBROADCAST_INTERVAL_MS",
  2_000,
);

/**
 * Derives the Anchor discriminator for an account type.
 * Anchor uses the first 8 bytes of sha256("account:<AccountName>")
 */
async function deriveDiscriminator(accountName: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(`account:${accountName}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer.slice(0, 8));
}

export class ArSubledgerService
  implements LedgerService, CustomerService, InvoiceService, SettlementService
{
  private readonly program: Program<Idl>;
  private readonly accountNs: any;
  private static readonly MIN_PAYER_LAMPORTS = Math.floor(0.02 * LAMPORTS_PER_SOL);
  private customerDiscriminator: Uint8Array | null = null;
  private invoiceDiscriminator: Uint8Array | null = null;

  constructor(private readonly wallet: EmbeddedWallet) {
    this.program = createArSubledgerProgram(wallet);
    this.accountNs = this.program.account as any;
  }

  private async getCustomerDiscriminator(): Promise<Uint8Array> {
    if (!this.customerDiscriminator) {
      this.customerDiscriminator = await deriveDiscriminator("Customer");
    }
    return this.customerDiscriminator;
  }

  private async getInvoiceDiscriminator(): Promise<Uint8Array> {
    if (!this.invoiceDiscriminator) {
      this.invoiceDiscriminator = await deriveDiscriminator("Invoice");
    }
    return this.invoiceDiscriminator;
  }

  private async ensureWalletFunded(minLamports = ArSubledgerService.MIN_PAYER_LAMPORTS): Promise<void> {
    const balance = await connection.getBalance(this.wallet.publicKey, "confirmed");
    if (balance >= minLamports) return;

    const topupLamports = minLamports - balance;
    const signature = await connection.requestAirdrop(this.wallet.publicKey, topupLamports);
    await connection.confirmTransaction(signature, "confirmed");
  }

  private isDebitWithoutCreditError(error: unknown): boolean {
    if (error instanceof SendTransactionError) {
      const msg = error.message.toLowerCase();
      return msg.includes("attempt to debit an account") || msg.includes("prior credit");
    }
    if (error instanceof Error) {
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
      if (!this.isDebitWithoutCreditError(error)) {
        throw error;
      }
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
      if (!this.isAccountDecodeRangeError(error)) {
        throw error;
      }

      console.warn(
        `[ArSubledgerService] Ignoring ${accountName} scan due to account decode mismatch (likely stale local validator data).`,
        error,
      );
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
    const signature = await connection.sendRawTransaction(serializedTransaction, {
      preflightCommitment: "confirmed",
      skipPreflight: false,
    });

    onSubmitted?.(signature);

    try {
      const start = Date.now();
      let lastRebroadcastAt = start;

      while (Date.now() - start < CONFIRMATION_WAIT_TIMEOUT_MS) {
        const status = await connection.getSignatureStatus(signature, {
          searchTransactionHistory: true,
        });

        if (status.value?.err) {
          throw new Error(
            `Transaction ${signature} failed on-chain: ${JSON.stringify(status.value.err)}`,
          );
        }

        if (
          status.value?.confirmationStatus === "confirmed" ||
          status.value?.confirmationStatus === "finalized"
        ) {
          return signature;
        }

        const currentBlockHeight = await connection.getBlockHeight("confirmed");
        if (currentBlockHeight > latestBlockhash.lastValidBlockHeight) {
          throw new Error(
            `Transaction ${signature} expired before confirmation (blockhash no longer valid).`,
          );
        }

        if (Date.now() - lastRebroadcastAt >= REBROADCAST_INTERVAL_MS) {
          try {
            await connection.sendRawTransaction(serializedTransaction, {
              skipPreflight: true,
              maxRetries: 0,
            });
          } catch {
            // Ignore rebroadcast errors and keep polling status.
          }
          lastRebroadcastAt = Date.now();
        }

        await new Promise((resolve) => {
          setTimeout(resolve, CONFIRMATION_POLL_INTERVAL_MS);
        });
      }

      throw new Error(`Confirmation timed out after ${CONFIRMATION_WAIT_TIMEOUT_MS / 1000}s`);
    } catch (error) {
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });
      const statusSummary = status.value
        ? JSON.stringify({
            confirmationStatus: status.value.confirmationStatus,
            confirmations: status.value.confirmations,
            err: status.value.err,
            slot: status.value.slot,
          })
        : "not found on current RPC";
      const message = error instanceof Error ? error.message : String(error);
      const rpcEndpoint = connection.rpcEndpoint;
      throw new Error(
        `Transaction ${signature} was submitted but confirmation is unresolved. RPC endpoint: ${rpcEndpoint}. RPC status: ${statusSummary}. ${message}. Verify with: solana confirm ${signature} --url ${rpcEndpoint}`,
      );
    }
  }

  /**
   * Fetch accounts filtered by a ledger pubkey using getProgramAccounts with memcmp.
   * The ledger field is at offset 8 (after the 8-byte Anchor discriminator).
   * This is much more efficient than fetching all accounts client-side.
   */
  private async getAccountsByLedger(
    programId: PublicKey,
    ledgerPubkey: PublicKey,
    discriminator: number[],
  ) {
    try {
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // After 8-byte discriminator
              bytes: ledgerPubkey.toBase58(),
            },
          },
          {
            memcmp: {
              offset: 0, // Discriminator at offset 0
              bytes: encodeMemcmpBytes(Uint8Array.from(discriminator)),
            },
          },
        ],
      });
      return accounts;
    } catch (error) {
      console.warn(`[ArSubledgerService] Failed to fetch accounts by ledger:`, error);
      return [];
    }
  }

  private mapLedgerRecord(pubkey: string, account: any): LedgerRecord {
    return {
      pubkey,
      authority: account.authority.toBase58(),
      ledgerCode: account.ledgerCode,
      accountingLedger: account.accountingLedger.toBase58(),
      arControlAccountCode: toNumber(account.arControlAccountCode),
      revenueAccountCode: toNumber(account.revenueAccountCode),
      cashAccountCode: toNumber(account.cashAccountCode),
      writeoffExpenseAccountCode: toNumber(account.writeoffExpenseAccountCode),
      nextJournalEntryId: toNumber(account.nextJournalEntryId),
      customerCount: toNumber(account.customerCount),
      invoiceCount: toNumber(account.invoiceCount),
    };
  }

  private async getRequiredLedgerRecord(ledger: PublicKey): Promise<LedgerRecord> {
    const record = await this.getLedger(ledger.toBase58());
    if (!record) {
      throw new Error(`Ledger account not found: ${ledger.toBase58()}`);
    }
    return record;
  }

  private getPostingAccounts(ledger: LedgerRecord) {
    const accountingLedger = new PublicKey(ledger.accountingLedger);
    const [journalEntry] = deriveJournalEntryPda(
      accountingLedger,
      BigInt(ledger.nextJournalEntryId),
    );
    const [arControlGl] = deriveGlAccountPda(accountingLedger, ledger.arControlAccountCode);
    const [revenueGl] = deriveGlAccountPda(accountingLedger, ledger.revenueAccountCode);
    const [cashGl] = deriveGlAccountPda(accountingLedger, ledger.cashAccountCode);
    const [writeoffExpenseGl] = deriveGlAccountPda(
      accountingLedger,
      ledger.writeoffExpenseAccountCode,
    );

    return {
      accountingLedger,
      journalEntry,
      arControlGl,
      revenueGl,
      cashGl,
      writeoffExpenseGl,
      accountingProgram: ACCOUNTING_ENGINE_PROGRAM_ID,
    };
  }

  async initializeLedger(input: InitializeLedgerInput): Promise<string> {
    const [ledgerPda] = deriveLedgerPda(this.wallet.publicKey, input.ledgerCode);
    const existingLedger = await this.getLedger(ledgerPda.toBase58());
    if (existingLedger) {
      throw new Error(
        `Ledger code '${input.ledgerCode}' already exists for this wallet. Use a different ledger code.`,
      );
    }

    await this.executeWithFundingRetry(async () => {
      await this.program.methods
        .initializeLedger(
          input.ledgerCode,
          input.arControlAccountCode,
          input.revenueAccountCode,
          input.cashAccountCode,
          input.writeoffExpenseAccountCode,
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

  async createCustomer(input: CreateCustomerInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const [customerPda] = deriveCustomerPda(ledger, input.customerCode);
    await this.executeWithFundingRetry(async () => {
      await this.program.methods
        .createCustomer(input.customerCode, input.customerName, new BN(input.creditLimitMinor))
        .accounts({
          authority: this.wallet.publicKey,
          ledger,
          customer: customerPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });
    return customerPda.toBase58();
  }

  async updateCustomer(input: UpdateCustomerInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const customer = new PublicKey(input.customerPubkey);

    await this.executeWithFundingRetry(async () => {
      await this.program.methods
        .updateCustomer(input.status, new BN(input.creditLimitMinor))
        .accounts({
          authority: this.wallet.publicKey,
          ledger,
          customer,
        })
        .rpc();
    });

    return customer.toBase58();
  }

  async issueInvoice(input: IssueInvoiceInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const customer = new PublicKey(input.customerPubkey);
    const [invoicePda] = deriveInvoicePda(ledger, input.invoiceNo);
    const postingAccounts = this.getPostingAccounts(await this.getRequiredLedgerRecord(ledger));

    await this.executeWithFundingRetry(async () => {
      await this.sendAndConfirmTransaction(
        () =>
          this.program.methods
            .issueInvoice(
              input.invoiceNo,
              new BN(input.amountMinor),
              new BN(input.issueDateUnix),
              new BN(input.dueDateUnix),
              input.currency,
              input.description,
            )
            .accounts({
              authority: this.wallet.publicKey,
              ledger,
              customer,
              invoice: invoicePda,
              accountingLedger: postingAccounts.accountingLedger,
              journalEntry: postingAccounts.journalEntry,
              arControlGl: postingAccounts.arControlGl,
              revenueGl: postingAccounts.revenueGl,
              accountingProgram: postingAccounts.accountingProgram,
              systemProgram: SystemProgram.programId,
            })
            .transaction(),
        input.onSubmitted,
      );
    });

    return invoicePda.toBase58();
  }

  async recordReceipt(input: RecordReceiptInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const customer = new PublicKey(input.customerPubkey);
    const invoice = new PublicKey(input.invoicePubkey);
    const [receiptPda] = deriveReceiptPda(invoice, BigInt(input.receiptSeq));
    const postingAccounts = this.getPostingAccounts(await this.getRequiredLedgerRecord(ledger));

    await this.executeWithFundingRetry(async () => {
      await this.sendAndConfirmTransaction(
        () =>
          this.program.methods
            .recordReceipt(
              new BN(input.receiptSeq),
              input.receiptNo,
              new BN(input.amountMinor),
              new BN(input.receiptDateUnix),
              input.paymentReference,
            )
            .accounts({
              authority: this.wallet.publicKey,
              ledger,
              customer,
              invoice,
              receipt: receiptPda,
              accountingLedger: postingAccounts.accountingLedger,
              journalEntry: postingAccounts.journalEntry,
              cashGl: postingAccounts.cashGl,
              arControlGl: postingAccounts.arControlGl,
              accountingProgram: postingAccounts.accountingProgram,
              systemProgram: SystemProgram.programId,
            })
            .transaction(),
        input.onSubmitted,
      );
    });

    return receiptPda.toBase58();
  }

  async issueCreditNote(input: IssueCreditNoteInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const customer = new PublicKey(input.customerPubkey);
    const invoice = new PublicKey(input.invoicePubkey);
    const [creditPda] = deriveCreditPda(invoice, BigInt(input.creditSeq));
    const postingAccounts = this.getPostingAccounts(await this.getRequiredLedgerRecord(ledger));

    await this.executeWithFundingRetry(async () => {
      await this.sendAndConfirmTransaction(
        () =>
          this.program.methods
            .issueCreditNote(
              new BN(input.creditSeq),
              input.creditNo,
              new BN(input.amountMinor),
              new BN(input.creditDateUnix),
              input.reason,
            )
            .accounts({
              authority: this.wallet.publicKey,
              ledger,
              customer,
              invoice,
              creditNote: creditPda,
              accountingLedger: postingAccounts.accountingLedger,
              journalEntry: postingAccounts.journalEntry,
              revenueGl: postingAccounts.revenueGl,
              arControlGl: postingAccounts.arControlGl,
              accountingProgram: postingAccounts.accountingProgram,
              systemProgram: SystemProgram.programId,
            })
            .transaction(),
        input.onSubmitted,
      );
    });

    return creditPda.toBase58();
  }

  async writeOffInvoice(input: WriteOffInvoiceInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const customer = new PublicKey(input.customerPubkey);
    const invoice = new PublicKey(input.invoicePubkey);
    const [writeoffPda] = deriveWriteOffPda(invoice);
    const postingAccounts = this.getPostingAccounts(await this.getRequiredLedgerRecord(ledger));

    await this.executeWithFundingRetry(async () => {
      await this.sendAndConfirmTransaction(
        () =>
          this.program.methods
            .writeOffInvoice(new BN(input.amountMinor), new BN(input.writeoffDateUnix), input.reason)
            .accounts({
              authority: this.wallet.publicKey,
              ledger,
              customer,
              invoice,
              writeoff: writeoffPda,
              accountingLedger: postingAccounts.accountingLedger,
              journalEntry: postingAccounts.journalEntry,
              writeoffExpenseGl: postingAccounts.writeoffExpenseGl,
              arControlGl: postingAccounts.arControlGl,
              accountingProgram: postingAccounts.accountingProgram,
              systemProgram: SystemProgram.programId,
            })
            .transaction(),
        input.onSubmitted,
      );
    });

    return writeoffPda.toBase58();
  }

  async closeInvoice(input: CloseInvoiceInput): Promise<string> {
    const ledger = new PublicKey(input.ledgerPubkey);
    const customer = new PublicKey(input.customerPubkey);
    const invoice = new PublicKey(input.invoicePubkey);

    await this.executeWithFundingRetry(async () => {
      await this.sendAndConfirmTransaction(
        () =>
          this.program.methods
            .closeInvoice()
            .accounts({
              authority: this.wallet.publicKey,
              ledger,
              customer,
              invoice,
            })
            .transaction(),
        input.onSubmitted,
      );
    });

    return input.invoicePubkey;
  }

  async listLedgers(): Promise<LedgerRecord[]> {
    const rows = (await this.safeAccountAll("ledgerConfig", () =>
      this.accountNs.ledgerConfig.all(),
    )) as any[];
    return rows.map((row) => this.mapLedgerRecord(row.publicKey.toBase58(), row.account));
  }

  async getLedger(pubkey: string): Promise<LedgerRecord | null> {
    try {
      const account = await this.accountNs.ledgerConfig.fetch(new PublicKey(pubkey));
      return this.mapLedgerRecord(pubkey, account);
    } catch {
      return null;
    }
  }

  async listCustomers(ledgerPubkey?: string): Promise<CustomerRecord[]> {
    // If ledgerPubkey is specified, use optimized filtering via getProgramAccounts
    if (ledgerPubkey) {
      try {
        const ledgerKey = new PublicKey(ledgerPubkey);
        const customerDiscriminator = await this.getCustomerDiscriminator();

        const accounts = await connection.getProgramAccounts(this.program.programId, {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: encodeMemcmpBytes(customerDiscriminator),
              },
            },
            {
              memcmp: {
                offset: 8, // After 8-byte discriminator
                bytes: ledgerKey.toBase58(),
              },
            },
          ],
        });

        return accounts.map((account) => {
          const accountData = this.program.coder.accounts.decode("customer", account.account.data);
          return {
            pubkey: account.pubkey.toBase58(),
            ledger: accountData.ledger.toBase58(),
            customerCode: accountData.customerCode,
            customerName: accountData.customerName,
            status: accountData.status,
            creditLimit: toNumber(accountData.creditLimit),
            totalOutstanding: toNumber(accountData.totalOutstanding),
            totalInvoiced: toNumber(accountData.totalInvoiced),
            totalPaid: toNumber(accountData.totalPaid),
            totalCredited: toNumber(accountData.totalCredited),
            totalWrittenOff: toNumber(accountData.totalWrittenOff),
            invoiceCount: toNumber(accountData.invoiceCount),
          };
        });
      } catch (error) {
        console.warn(`[ArSubledgerService] Optimized customer listing failed, falling back to full scan:`, error);
      }
    }

    // Fallback: fetch all customers and filter client-side
    const rows = (await this.safeAccountAll("customer", () => this.accountNs.customer.all())) as any[];
    return rows
      .map((row) => ({
        pubkey: row.publicKey.toBase58(),
        ledger: row.account.ledger.toBase58(),
        customerCode: row.account.customerCode,
        customerName: row.account.customerName,
        status: row.account.status,
        creditLimit: toNumber(row.account.creditLimit),
        totalOutstanding: toNumber(row.account.totalOutstanding),
        totalInvoiced: toNumber(row.account.totalInvoiced),
        totalPaid: toNumber(row.account.totalPaid),
        totalCredited: toNumber(row.account.totalCredited),
        totalWrittenOff: toNumber(row.account.totalWrittenOff),
        invoiceCount: toNumber(row.account.invoiceCount),
      }))
      .filter((row) => (ledgerPubkey ? row.ledger === ledgerPubkey : true));
  }

  async getCustomer(pubkey: string): Promise<CustomerRecord | null> {
    try {
      const account = await this.accountNs.customer.fetch(new PublicKey(pubkey));
      return {
        pubkey,
        ledger: account.ledger.toBase58(),
        customerCode: account.customerCode,
        customerName: account.customerName,
        status: account.status,
        creditLimit: toNumber(account.creditLimit),
        totalOutstanding: toNumber(account.totalOutstanding),
        totalInvoiced: toNumber(account.totalInvoiced),
        totalPaid: toNumber(account.totalPaid),
        totalCredited: toNumber(account.totalCredited),
        totalWrittenOff: toNumber(account.totalWrittenOff),
        invoiceCount: toNumber(account.invoiceCount),
      };
    } catch {
      return null;
    }
  }

  async listInvoices(ledgerPubkey?: string): Promise<InvoiceRecord[]> {
    // If ledgerPubkey is specified, use optimized filtering via getProgramAccounts
    if (ledgerPubkey) {
      try {
        const ledgerKey = new PublicKey(ledgerPubkey);
        const invoiceDiscriminator = await this.getInvoiceDiscriminator();

        const accounts = await connection.getProgramAccounts(this.program.programId, {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: encodeMemcmpBytes(invoiceDiscriminator),
              },
            },
            {
              memcmp: {
                offset: 8, // After 8-byte discriminator
                bytes: ledgerKey.toBase58(),
              },
            },
          ],
        });

        return accounts.map((account) => {
          const accountData = this.program.coder.accounts.decode("invoice", account.account.data);
          return {
            pubkey: account.pubkey.toBase58(),
            ledger: accountData.ledger.toBase58(),
            customer: accountData.customer.toBase58(),
            invoiceNo: accountData.invoiceNo,
            originalAmount: toNumber(accountData.originalAmount),
            openAmount: toNumber(accountData.openAmount),
            paidAmount: toNumber(accountData.paidAmount),
            creditedAmount: toNumber(accountData.creditedAmount),
            writtenOffAmount: toNumber(accountData.writtenOffAmount),
            currency: accountData.currency,
            description: accountData.description,
            issueDate: toNumber(accountData.issueDate),
            dueDate: toNumber(accountData.dueDate),
            status: accountData.status,
            receiptSeq: toNumber(accountData.receiptSeq),
            creditSeq: toNumber(accountData.creditSeq),
            journalEntryId: toNumber(accountData.journalEntryId),
            hasWriteoff: accountData.hasWriteoff,
          };
        });
      } catch (error) {
        console.warn(`[ArSubledgerService] Optimized invoice listing failed, falling back to full scan:`, error);
      }
    }

    // Fallback: fetch all invoices and filter client-side
    const rows = (await this.safeAccountAll("invoice", () => this.accountNs.invoice.all())) as any[];
    return rows
      .map((row) => ({
        pubkey: row.publicKey.toBase58(),
        ledger: row.account.ledger.toBase58(),
        customer: row.account.customer.toBase58(),
        invoiceNo: row.account.invoiceNo,
        originalAmount: toNumber(row.account.originalAmount),
        openAmount: toNumber(row.account.openAmount),
        paidAmount: toNumber(row.account.paidAmount),
        creditedAmount: toNumber(row.account.creditedAmount),
        writtenOffAmount: toNumber(row.account.writtenOffAmount),
        currency: row.account.currency,
        description: row.account.description,
        issueDate: toNumber(row.account.issueDate),
        dueDate: toNumber(row.account.dueDate),
        status: row.account.status,
        receiptSeq: toNumber(row.account.receiptSeq),
        creditSeq: toNumber(row.account.creditSeq),
        journalEntryId: toNumber(row.account.journalEntryId),
        hasWriteoff: row.account.hasWriteoff,
      }))
      .filter((row) => (ledgerPubkey ? row.ledger === ledgerPubkey : true));
  }

  async getInvoice(pubkey: string): Promise<InvoiceRecord | null> {
    try {
      const account = await this.accountNs.invoice.fetch(new PublicKey(pubkey));
      return {
        pubkey,
        ledger: account.ledger.toBase58(),
        customer: account.customer.toBase58(),
        invoiceNo: account.invoiceNo,
        originalAmount: toNumber(account.originalAmount),
        openAmount: toNumber(account.openAmount),
        paidAmount: toNumber(account.paidAmount),
        creditedAmount: toNumber(account.creditedAmount),
        writtenOffAmount: toNumber(account.writtenOffAmount),
        currency: account.currency,
        description: account.description,
        issueDate: toNumber(account.issueDate),
        dueDate: toNumber(account.dueDate),
        status: account.status,
        receiptSeq: toNumber(account.receiptSeq),
        creditSeq: toNumber(account.creditSeq),
        journalEntryId: toNumber(account.journalEntryId),
        hasWriteoff: account.hasWriteoff,
      };
    } catch {
      return null;
    }
  }

  async listReceipts(invoicePubkey?: string): Promise<ReceiptRecord[]> {
    const rows = (await this.safeAccountAll("receipt", () => this.accountNs.receipt.all())) as any[];
    return rows
      .map((row) => ({
        pubkey: row.publicKey.toBase58(),
        invoice: row.account.invoice.toBase58(),
        receiptSeq: toNumber(row.account.receiptSeq),
        receiptNo: row.account.receiptNo,
        amount: toNumber(row.account.amount),
        receiptDate: toNumber(row.account.receiptDate),
        paymentReference: row.account.paymentReference,
        journalEntryId: toNumber(row.account.journalEntryId),
      }))
      .filter((row) => (invoicePubkey ? row.invoice === invoicePubkey : true));
  }

  async listCreditNotes(invoicePubkey?: string): Promise<CreditNoteRecord[]> {
    const rows = (await this.safeAccountAll("creditNote", () =>
      this.accountNs.creditNote.all(),
    )) as any[];
    return rows
      .map((row) => ({
        pubkey: row.publicKey.toBase58(),
        invoice: row.account.invoice.toBase58(),
        creditSeq: toNumber(row.account.creditSeq),
        creditNo: row.account.creditNo,
        amount: toNumber(row.account.amount),
        creditDate: toNumber(row.account.creditDate),
        reason: row.account.reason,
        journalEntryId: toNumber(row.account.journalEntryId),
      }))
      .filter((row) => (invoicePubkey ? row.invoice === invoicePubkey : true));
  }

  async listWriteOffs(invoicePubkey?: string): Promise<WriteOffRecord[]> {
    const rows = (await this.safeAccountAll("writeOff", () => this.accountNs.writeOff.all())) as any[];
    return rows
      .map((row) => ({
        pubkey: row.publicKey.toBase58(),
        invoice: row.account.invoice.toBase58(),
        amount: toNumber(row.account.amount),
        writeoffDate: toNumber(row.account.writeoffDate),
        reason: row.account.reason,
        journalEntryId: toNumber(row.account.journalEntryId),
      }))
      .filter((row) => (invoicePubkey ? row.invoice === invoicePubkey : true));
  }

  async listActivity(): Promise<ActivityItem[]> {
    const [receipts, credits, writeOffs, invoices] = await Promise.all([
      this.listReceipts(),
      this.listCreditNotes(),
      this.listWriteOffs(),
      this.listInvoices(),
    ]);

    const activity: ActivityItem[] = [
      ...receipts.map((r) => ({
        id: `receipt-${r.pubkey}`,
        type: "receipt_recorded" as const,
        invoice: r.invoice,
        amount: r.amount,
        documentNo: r.receiptNo,
        occurredAt: r.receiptDate,
        details: `Receipt ${r.receiptNo}`,
      })),
      ...credits.map((c) => ({
        id: `credit-${c.pubkey}`,
        type: "credit_note_issued" as const,
        invoice: c.invoice,
        amount: c.amount,
        documentNo: c.creditNo,
        occurredAt: c.creditDate,
        details: `Credit note ${c.creditNo}`,
      })),
      ...writeOffs.map((w) => ({
        id: `writeoff-${w.pubkey}`,
        type: "invoice_written_off" as const,
        invoice: w.invoice,
        amount: w.amount,
        occurredAt: w.writeoffDate,
        details: `Write-off reason: ${w.reason}`,
      })),
      ...invoices.map((i) => ({
        id: `invoice-${i.pubkey}`,
        type: "invoice_issued" as const,
        invoice: i.pubkey,
        customer: i.customer,
        amount: i.originalAmount,
        documentNo: i.invoiceNo,
        occurredAt: i.issueDate,
        details: `Invoice ${i.invoiceNo}`,
      })),
    ];

    return activity.sort((a, b) => b.occurredAt - a.occurredAt);
  }
}

export function createArSubledgerService(wallet: EmbeddedWallet): ArSubledgerService {
  return new ArSubledgerService(wallet);
}
