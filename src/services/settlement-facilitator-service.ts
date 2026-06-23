"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Program, Idl } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey, SendTransactionError, SystemProgram, Transaction } from "@solana/web3.js";
import {
  BN,
  connection,
  createAccountingEngineProgram,
  createApSubledgerProgram,
  createArSubledgerProgram,
  createSettlementFacilitatorProgram,
} from "@/lib/solana/anchor-client";
import { ACCOUNTING_ENGINE_PROGRAM_ID } from "@/lib/solana/constants";
import type { EmbeddedWallet } from "@/lib/solana/embedded-wallet";
import {
  deriveGlAccountPda,
  deriveInvoicePda,
  deriveJournalEntryPda,
  derivePostingDelegatePda,
  deriveSettlementDocumentPda,
  deriveSettlementExecutionPda,
  deriveSettlementRoutePda,
  deriveVendorInvoicePda,
} from "@/lib/solana/pdas";
import type {
  SettlementDocumentRecord,
  SettlementExecutionRecord,
  SettlementRouteRecord,
} from "@/lib/types/domain";
import type {
  CancelSettlementDocumentInput,
  ExecuteSettlementInput,
  InitializeSettlementRouteInput,
  RegisterSettlementDocumentInput,
  SettlementFacilitatorService as SettlementFacilitatorServiceContract,
} from "@/services/contracts";

function toNumber(value: BN | number | bigint): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return value.toNumber();
}

const CONFIRMATION_WAIT_TIMEOUT_MS = 45_000;
const CONFIRMATION_POLL_INTERVAL_MS = 1_200;

export class SettlementFacilitatorService implements SettlementFacilitatorServiceContract {
  private readonly program: Program<Idl>;
  private readonly apProgram: Program<Idl>;
  private readonly arProgram: Program<Idl>;
  private readonly accountNs: any;
  private readonly apAccountNs: any;
  private readonly arAccountNs: any;
  private readonly accountingAccountNs: any;
  private static readonly MIN_PAYER_LAMPORTS = Math.floor(0.02 * LAMPORTS_PER_SOL);

  constructor(private readonly wallet: EmbeddedWallet) {
    this.program = createSettlementFacilitatorProgram(wallet);
    this.apProgram = createApSubledgerProgram(wallet);
    this.arProgram = createArSubledgerProgram(wallet);
    this.accountNs = this.program.account as any;
    this.apAccountNs = this.apProgram.account as any;
    this.arAccountNs = this.arProgram.account as any;
    this.accountingAccountNs = createAccountingEngineProgram(wallet).account as any;
  }

  private async ensureWalletFunded(minLamports = SettlementFacilitatorService.MIN_PAYER_LAMPORTS): Promise<void> {
    const balance = await connection.getBalance(this.wallet.publicKey, "confirmed");
    if (balance >= minLamports) return;

    const signature = await connection.requestAirdrop(this.wallet.publicKey, minLamports - balance);
    await connection.confirmTransaction(signature, "confirmed");
  }

  private async sendAndConfirmTransaction(
    buildTransaction: () => Promise<Transaction>,
    onSubmitted?: (signature: string) => void,
  ): Promise<string> {
    await this.ensureWalletFunded();
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

  private isAccountDecodeRangeError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes("trying to access beyond buffer length") ||
      msg.includes("out of range") ||
      msg.includes("failed to decode")
    );
  }

  private async safeAccountAll<T>(accountName: string, fetcher: () => Promise<T[]>): Promise<T[]> {
    try {
      return await fetcher();
    } catch (error) {
      if (!this.isAccountDecodeRangeError(error)) throw error;
      console.warn(`[SettlementFacilitatorService] Ignoring ${accountName} scan due to account decode mismatch.`, error);
      return [];
    }
  }

  private mapRouteRecord(pubkey: string, account: any): SettlementRouteRecord {
    const facilitator = account.facilitator;
    const buyerAuthority = account.buyerAuthority ?? account.buyer_authority;
    const supplierAuthority = account.supplierAuthority ?? account.supplier_authority;
    const buyerApLedger = account.buyerApLedger ?? account.buyer_ap_ledger;
    const supplierArLedger = account.supplierArLedger ?? account.supplier_ar_ledger;
    const buyerAccountingLedger = account.buyerAccountingLedger ?? account.buyer_accounting_ledger;
    const supplierAccountingLedger = account.supplierAccountingLedger ?? account.supplier_accounting_ledger;
    const routeCode = account.routeCode ?? account.route_code;
    const documentCount = account.documentCount ?? account.document_count;
    const nextSettlementSeq = account.nextSettlementSeq ?? account.next_settlement_seq;

    return {
      pubkey,
      facilitator: facilitator.toBase58(),
      buyerAuthority: buyerAuthority.toBase58(),
      supplierAuthority: supplierAuthority.toBase58(),
      buyerApLedger: buyerApLedger.toBase58(),
      supplierArLedger: supplierArLedger.toBase58(),
      buyerAccountingLedger: buyerAccountingLedger.toBase58(),
      supplierAccountingLedger: supplierAccountingLedger.toBase58(),
      routeCode,
      documentCount: toNumber(documentCount),
      nextSettlementSeq: toNumber(nextSettlementSeq),
      active: Boolean(account.active),
    };
  }

  private mapDocumentRecord(pubkey: string, account: any): SettlementDocumentRecord {
    return {
      pubkey,
      route: account.route.toBase58(),
      invoiceNo: account.invoiceNo,
      documentHash: account.documentHash,
      currency: account.currency,
      originalAmount: toNumber(account.originalAmount),
      openAmount: toNumber(account.openAmount),
      settledAmount: toNumber(account.settledAmount),
      status: toNumber(account.status),
    };
  }

  private mapExecutionRecord(pubkey: string, account: any): SettlementExecutionRecord {
    return {
      pubkey,
      route: account.route.toBase58(),
      document: account.document.toBase58(),
      settlementSeq: toNumber(account.settlementSeq),
      amount: toNumber(account.amount),
      buyerJournalEntryId: toNumber(account.buyerJournalEntryId),
      supplierJournalEntryId: toNumber(account.supplierJournalEntryId),
      buyerJournalEntry: account.buyerJournalEntry.toBase58(),
      supplierJournalEntry: account.supplierJournalEntry.toBase58(),
      memo: account.memo,
      executedAt: toNumber(account.executedAt),
    };
  }

  async initializeRoute(input: InitializeSettlementRouteInput): Promise<string> {
    const [route] = deriveSettlementRoutePda(this.wallet.publicKey, input.routeCode);
    await this.sendAndConfirmTransaction(
      () =>
        this.program.methods
          .initializeRoute(input.routeCode)
          .accounts({
            facilitator: this.wallet.publicKey,
            route,
            buyerApLedger: new PublicKey(input.buyerApLedgerPubkey),
            supplierArLedger: new PublicKey(input.supplierArLedgerPubkey),
            systemProgram: SystemProgram.programId,
          })
          .transaction(),
      input.onSubmitted,
    );
    return route.toBase58();
  }

  async getRoute(pubkey: string): Promise<SettlementRouteRecord | null> {
    try {
      const account = await this.accountNs.settlementRoute.fetch(new PublicKey(pubkey));
      return this.mapRouteRecord(pubkey, account);
    } catch {
      return null;
    }
  }

  async registerDocument(input: RegisterSettlementDocumentInput): Promise<string> {
    const route = new PublicKey(input.routePubkey);
    const [document] = deriveSettlementDocumentPda(route, input.documentHash);
    await this.sendAndConfirmTransaction(
      () =>
        this.program.methods
          .registerDocument(
            input.invoiceNo,
            input.documentHash,
            input.currency,
            new BN(input.originalAmount),
          )
          .accounts({
            facilitator: this.wallet.publicKey,
            route,
            document,
            systemProgram: SystemProgram.programId,
          })
          .transaction(),
      input.onSubmitted,
    );
    return document.toBase58();
  }

  async getDocument(pubkey: string): Promise<SettlementDocumentRecord | null> {
    try {
      const account = await this.accountNs.settlementDocument.fetch(new PublicKey(pubkey));
      return this.mapDocumentRecord(pubkey, account);
    } catch {
      return null;
    }
  }

  async cancelDocument(input: CancelSettlementDocumentInput): Promise<string> {
    const route = new PublicKey(input.routePubkey);
    const document = new PublicKey(input.documentPubkey);
    await this.sendAndConfirmTransaction(
      () =>
        this.program.methods
          .cancelDocument()
          .accounts({
            facilitator: this.wallet.publicKey,
            route,
            document,
          })
          .transaction(),
      input.onSubmitted,
    );
    return document.toBase58();
  }

  async executeSettlement(input: ExecuteSettlementInput): Promise<string> {
    const route = new PublicKey(input.routePubkey);
    const document = new PublicKey(input.documentPubkey);
    const routeRecord = await this.accountNs.settlementRoute.fetch(route);
    const documentRecord = await this.accountNs.settlementDocument.fetch(document);
    const buyerLedger = routeRecord.buyerAccountingLedger as PublicKey;
    const supplierLedger = routeRecord.supplierAccountingLedger as PublicKey;
    const buyerApLedger = routeRecord.buyerApLedger as PublicKey;
    const supplierArLedger = routeRecord.supplierArLedger as PublicKey;
    const buyerApConfig = await this.apAccountNs.buyerLedgerConfig.fetch(buyerApLedger);
    const supplierArConfig = await this.arAccountNs.ledgerConfig.fetch(supplierArLedger);
    const [buyerAccountingConfig, supplierAccountingConfig] = await Promise.all([
      this.accountingAccountNs.glConfig.fetch(buyerLedger),
      this.accountingAccountNs.glConfig.fetch(supplierLedger),
    ]);
    const settlementSeq = BigInt(input.settlementSeq);
    const buyerJournalCount = BigInt(
      (buyerAccountingConfig.journalEntryCount ?? buyerAccountingConfig.journal_entry_count).toString(),
    );
    const supplierJournalCount = BigInt(
      (supplierAccountingConfig.journalEntryCount ?? supplierAccountingConfig.journal_entry_count).toString(),
    );
    const buyerJournalEntryId = buyerJournalCount + BigInt(1);
    const supplierJournalEntryId = buyerLedger.equals(supplierLedger)
      ? buyerJournalEntryId + BigInt(1)
      : supplierJournalCount + BigInt(1);
    const [execution] = deriveSettlementExecutionPda(document, settlementSeq);
    const [buyerJournalEntry] = deriveJournalEntryPda(buyerLedger, buyerJournalEntryId);
    const [supplierJournalEntry] = deriveJournalEntryPda(supplierLedger, supplierJournalEntryId);
    const [buyerPostingDelegate] = derivePostingDelegatePda(buyerLedger, this.wallet.publicKey);
    const [supplierPostingDelegate] = derivePostingDelegatePda(supplierLedger, this.wallet.publicKey);
    const [buyerDebitGl] = deriveGlAccountPda(buyerLedger, toNumber(buyerApConfig.apControlAccountCode));
    const [buyerCreditGl] = deriveGlAccountPda(buyerLedger, toNumber(buyerApConfig.cashAccountCode));
    const [supplierDebitGl] = deriveGlAccountPda(supplierLedger, toNumber(supplierArConfig.cashAccountCode));
    const [supplierCreditGl] = deriveGlAccountPda(supplierLedger, toNumber(supplierArConfig.arControlAccountCode));
    const [buyerApInvoice] = deriveVendorInvoicePda(buyerApLedger, documentRecord.invoiceNo);
    const [supplierArInvoice] = deriveInvoicePda(supplierArLedger, documentRecord.invoiceNo);

    await this.sendAndConfirmTransaction(
      () =>
        this.program.methods
          .executeSettlement(new BN(input.settlementSeq), new BN(input.amountMinor), input.memo)
          .accounts({
            facilitator: this.wallet.publicKey,
            route,
            document,
            execution,
            buyerAccountingLedger: buyerLedger,
            supplierAccountingLedger: supplierLedger,
            buyerApLedger,
            supplierArLedger,
            buyerApInvoice,
            supplierArInvoice,
            buyerPostingDelegate,
            supplierPostingDelegate,
            buyerJournalEntry,
            supplierJournalEntry,
            buyerDebitGl,
            buyerCreditGl,
            supplierDebitGl,
            supplierCreditGl,
            accountingProgram: ACCOUNTING_ENGINE_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .transaction(),
      input.onSubmitted,
    );
    return execution.toBase58();
  }

  async listRoutes(): Promise<SettlementRouteRecord[]> {
    const routeAccount = this.program.idl.accounts?.find((account) => account.name === "settlementRoute");
    if (!routeAccount?.discriminator) {
      throw new Error("SettlementRoute discriminator is missing from the runtime IDL.");
    }

    const discriminator = Buffer.from(routeAccount.discriminator);
    const programAccounts = await connection.getProgramAccounts(this.program.programId);
    const routes: SettlementRouteRecord[] = [];

    for (const { pubkey, account } of programAccounts) {
      const data = account.data;
      if (
        data.length < discriminator.length ||
        !data.subarray(0, discriminator.length).equals(discriminator)
      ) {
        continue;
      }

      try {
        const decoded = this.program.coder.accounts.decode("settlementRoute", data);
        routes.push(this.mapRouteRecord(pubkey.toBase58(), decoded));
      } catch (error) {
        console.warn(
          `[SettlementFacilitatorService] Skipping incompatible SettlementRoute account ${pubkey.toBase58()}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return routes;
  }

  async listDocuments(routePubkey?: string): Promise<SettlementDocumentRecord[]> {
    const rows = (await this.safeAccountAll("settlementDocument", () =>
      this.accountNs.settlementDocument.all(),
    )) as any[];
    return rows
      .map((row) => this.mapDocumentRecord(row.publicKey.toBase58(), row.account))
      .filter((row) => (routePubkey ? row.route === routePubkey : true));
  }

  async getExecution(pubkey: string): Promise<SettlementExecutionRecord | null> {
    try {
      const account = await this.accountNs.settlementExecution.fetch(new PublicKey(pubkey));
      return this.mapExecutionRecord(pubkey, account);
    } catch {
      return null;
    }
  }

  async listExecutions(documentPubkey?: string): Promise<SettlementExecutionRecord[]> {
    const rows = (await this.safeAccountAll("settlementExecution", () =>
      this.accountNs.settlementExecution.all(),
    )) as any[];
    return rows
      .map((row) => this.mapExecutionRecord(row.publicKey.toBase58(), row.account))
      .filter((row) => (documentPubkey ? row.document === documentPubkey : true));
  }
}

export function createSettlementFacilitatorService(wallet: EmbeddedWallet): SettlementFacilitatorService {
  return new SettlementFacilitatorService(wallet);
}
