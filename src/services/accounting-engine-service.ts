      // Helper to map category to IDL enum variant
      function mapCategory(category: string) {
        switch (category) {
          case "Asset": return "asset";
          case "Liability": return "liability";
          case "Equity": return "equity";
          case "Revenue": return "revenue";
          case "Expense": return "expense";
          default: throw new Error(`Unknown AccountCategory: ${category}`);
        }
      }

      function mapNormalSide(normalSide: string) {
        switch (normalSide) {
          case "Debit": return "debit";
          case "Credit": return "credit";
          default: throw new Error(`Unknown NormalSide: ${normalSide}`);
        }
      }
import { Program, AnchorProvider, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SendTransactionError, Transaction, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import accountingEngineIdl from "@/lib/idl/accounting_engine.json";
import { env } from "@/lib/config/env";
import type { EmbeddedWallet } from "@/lib/solana/embedded-wallet";

export interface GlAccount {
  publicKey: PublicKey;
  account: {
    ledger: PublicKey;
    code: number;
    name: string;
    category: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
    normalSide: "Debit" | "Credit";
    balance: bigint;
    bump: number;
  };
}

export interface JournalEntry {
  publicKey: PublicKey;
  account: {
    ledger: PublicKey;
    entryId: bigint;
    externalRef: string;
    memo: string;
    totalDebit: bigint;
    totalCredit: bigint;
    lineCount: number;
    postedAt: bigint;
    bump: number;
  };
}

export interface PostingLine {
  accountCode: number;
  amount: bigint;
  isDebit: boolean;
}

export interface AccountingLedger {
  publicKey: PublicKey;
  account: {
    authority: PublicKey;
    ledgerCode: string;
    journalEntryCount: bigint;
    bump: number;
  };
}

export interface AccountingLedgerDiscoveryDebug {
  programId: string;
  authority: string;
  memcmpHits: number;
  scannedAccounts: number;
  decodedLedgerConfigs: number;
  authorityMatches: number;
}

const ACCOUNTING_ENGINE_PROGRAM_ID = "93p9XxgYZJ6SwMskEASTmBPsGioB1RYbdGHqUKdDvm3q";
const LEDGER_SEED = "ledger";
const GL_ACCOUNT_SEED = "gl";
const MAX_LEDGER_CODE_LEN = 24;
const connection = new Connection(env.solanaRpcUrl, "confirmed");

const readOnlyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async <T extends Transaction>(tx: T): Promise<T> => tx,
  signAllTransactions: async <T extends Transaction>(txs: T[]): Promise<T[]> => txs,
};

function getProvider(): AnchorProvider {
  return new AnchorProvider(connection, readOnlyWallet as AnchorProvider["wallet"], {
    commitment: "confirmed",
  });
}

class AccountingEngineService {
  private program: Program<Idl> | null = null;

  private getGlConfigDiscriminator(): Buffer | null {
    const runtimeIdl = this.getRuntimeIdl() as Idl & {
      accounts?: Array<{ name?: string; discriminator?: number[] }>;
    };
    const discriminator = runtimeIdl.accounts?.find((account) => account.name === "GlConfig")?.discriminator;
    if (!discriminator || discriminator.length !== 8) {
      return null;
    }
    return Buffer.from(discriminator);
  }

  private tryDecodeCurrentGlConfig(program: Program<Idl>, data: Buffer): Record<string, unknown> | null {
    try {
      return program.coder.accounts.decode("GlConfig", data) as Record<string, unknown>;
    } catch {
      const glConfigDiscriminator = this.getGlConfigDiscriminator();
      if (!glConfigDiscriminator) {
        return null;
      }

      // Some deployed builds store ledger_code in a fixed-width region (MAX_LEDGER_CODE_LEN)
      // while still using the GlConfig discriminator. Decode that strict GlConfig wire layout.
      const minSize = 8 + 32 + 4 + MAX_LEDGER_CODE_LEN + 8 + 1;
      if (data.length < minSize) {
        return null;
      }

      const discriminator = data.subarray(0, 8);
      if (!discriminator.equals(glConfigDiscriminator)) {
        return null;
      }

      try {
        let offset = 8;
        const authority = new PublicKey(data.subarray(offset, offset + 32));
        offset += 32;

        const ledgerCodeLen = data.readUInt32LE(offset);
        offset += 4;

        const codeRegion = data.subarray(offset, offset + MAX_LEDGER_CODE_LEN);
        offset += MAX_LEDGER_CODE_LEN;

        const safeLen = Math.min(ledgerCodeLen, MAX_LEDGER_CODE_LEN);
        const ledgerCode = codeRegion.subarray(0, safeLen).toString("utf8").replace(/\0+$/, "");

        const journalEntryCount = data.readBigUInt64LE(offset);
        offset += 8;

        const bump = data.readUInt8(offset);

        return {
          authority,
          ledgerCode,
          ledger_code: ledgerCode,
          journalEntryCount,
          journal_entry_count: journalEntryCount,
          bump,
        };
      } catch {
        return null;
      }
    }
  }

  private getRuntimeIdl(): Idl {
    return {
      ...(accountingEngineIdl as Idl & { address?: string }),
      address: env.accountingEngineProgramId || ACCOUNTING_ENGINE_PROGRAM_ID,
    } as Idl;
  }

  private getWritableProgram(wallet: EmbeddedWallet): Program<Idl> {
    const provider = new AnchorProvider(connection, wallet as AnchorProvider["wallet"], {
      commitment: "confirmed",
    });
    return new Program(this.getRuntimeIdl(), provider);
  }

  async getProgram(): Promise<Program<Idl>> {
    if (!this.program) {
      const provider = getProvider();
      this.program = new Program(this.getRuntimeIdl(), provider);
    }
    return this.program;
  }

  async initializeLedger(ledgerCode: string, wallet: EmbeddedWallet): Promise<string> {
    const normalizedLedgerCode = ledgerCode.trim().toUpperCase();
    if (!normalizedLedgerCode) {
      throw new Error("Ledger code is required");
    }

    const program = this.getWritableProgram(wallet);
    const [ledgerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(LEDGER_SEED), wallet.publicKey.toBuffer(), Buffer.from(normalizedLedgerCode)],
      program.programId,
    );

    const existing = await connection.getAccountInfo(ledgerPda, "confirmed");
    if (existing) {
      const decodedExisting = this.tryDecodeCurrentGlConfig(program, existing.data);
      if (decodedExisting) {
        return ledgerPda.toBase58();
      }
      throw new Error(
        "An account already exists at this ledger PDA but is not current accounting_engine GlConfig. Reset local validator state or create a ledger with a different code.",
      );
    }

    await program.methods
      .initializeLedger(normalizedLedgerCode)
      .accounts({
        authority: wallet.publicKey,
        ledger: ledgerPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const created = await connection.getAccountInfo(ledgerPda, "confirmed");
    if (!created || !this.tryDecodeCurrentGlConfig(program, created.data)) {
      throw new Error("Initialized ledger account did not decode as GlConfig.");
    }

    return ledgerPda.toBase58();
  }

  /**
   * Initialize 4 default GL accounts (Cash, AR Control, Revenue, Write-off Expense)
   * Must be called after ledger initialization
   */
  async initializeGlAccounts(
    ledgerKey: PublicKey,
    authority: EmbeddedWallet | Keypair,
  ): Promise<{ success: boolean; txs: string[]; error?: string }> {
    try {
      const program = await this.getProgram();
      const provider = getProvider() as AnchorProvider;

      const defaultAccounts = [
        {
          code: 1000,
          name: "Cash",
          category: "Asset",
          normalSide: "Debit",
        },
        {
          code: 1100,
          name: "AR Control",
          category: "Asset",
          normalSide: "Debit",
        },
        {
          code: 4000,
          name: "Revenue",
          category: "Revenue",
          normalSide: "Credit",
        },
        {
          code: 5000,
          name: "Write-off Expense",
          category: "Expense",
          normalSide: "Debit",
        },
      ];

      const txs: string[] = [];

      for (const account of defaultAccounts) {
        try {
          // Derive PDA for GL account
          const [glAccountPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(GL_ACCOUNT_SEED), ledgerKey.toBuffer(), Buffer.from(new Uint32Array([account.code]).buffer)],
            program.programId,
          );

          // Check if account already exists
          const existingAccount = await provider.connection.getAccountInfo(glAccountPda);
          if (existingAccount) {
            console.log(`GL Account ${account.code} already exists, skipping`);
            continue;
          }

          // Log and map enum values
          const mappedCategory = mapCategory(account.category);
          const mappedNormalSide = mapNormalSide(account.normalSide);

          // Runtime check for enum variant validity
          const validCategories = ["asset", "liability", "equity", "revenue", "expense"];
          const validNormalSides = ["debit", "credit"];
          if (!validCategories.includes(mappedCategory)) {
            throw new Error(`Invalid AccountCategory variant: ${mappedCategory}`);
          }
          if (!validNormalSides.includes(mappedNormalSide)) {
            throw new Error(`Invalid NormalSide variant: ${mappedNormalSide}`);
          }

          // Log the exact argument structure
          const categoryArg = { [mappedCategory]: {} };
          const normalSideArg = { [mappedNormalSide]: {} };
          console.log("[DEBUG] createGlAccount args:", {
            code: account.code,
            name: account.name,
            category: categoryArg,
            normalSide: normalSideArg,
          });

          // Create instruction to create GL account
          const createGlAccountIx = await program.methods
            .createGlAccount(
              account.code,
              account.name,
              categoryArg,
              normalSideArg
            )
            .accounts({
              authority: authority.publicKey,
              ledger: ledgerKey,
              glAccount: glAccountPda,
              systemProgram: PublicKey.default,
            })
            .instruction();

          // Build transaction
          const tx = new Transaction().add(createGlAccountIx);
          tx.feePayer = authority.publicKey;
          tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;

          // Sign and send
          if ("signTransaction" in authority) {
            await authority.signTransaction(tx);
          } else {
            tx.sign(authority);
          }
          let txSig: string;
          try {
            txSig = await provider.connection.sendRawTransaction(tx.serialize());
          } catch (error) {
            if (error instanceof SendTransactionError) {
              let logs: string[] | undefined;
              try {
                logs = await error.getLogs(provider.connection);
              } catch {
                logs = undefined;
              }

              const logsText = logs?.length ? ` Logs: ${JSON.stringify(logs)}` : " Logs: []";
              throw new Error(`GL account ${account.code} simulation failed.${logsText} ${error.message}`.trim());
            }
            throw error;
          }
          await provider.connection.confirmTransaction(txSig);

          txs.push(txSig);
          console.log(`Created GL Account ${account.code}: ${txSig}`);
        } catch (err) {
          console.error(`Failed to create GL Account ${account.code}:`, err);
          throw err;
        }
      }

      return { success: true, txs };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, txs: [], error: errorMessage };
    }
  }

  /**
   * List all GL accounts for a ledger
   */
  async listGlAccounts(ledgerKey: PublicKey): Promise<GlAccount[]> {
    try {
      const program = await this.getProgram();
      const provider = getProvider() as AnchorProvider;

      // Get GlAccount discriminator to filter only GlAccount-type accounts
      const runtimeIdl = this.getRuntimeIdl() as typeof accountingEngineIdl;
      const glAccountDiscriminator = (runtimeIdl as { accounts?: Array<{ name: string; discriminator?: number[] }> }).accounts
        ?.find((a) => a.name === "GlAccount")?.discriminator;

      const filters: { memcmp: { offset: number; bytes: string } }[] = [
        {
          memcmp: {
            offset: 8, // Skip discriminator; ledger field starts at byte 8
            bytes: ledgerKey.toBase58(),
          },
        },
      ];

      if (glAccountDiscriminator) {
        filters.unshift({
          memcmp: {
            offset: 0,
            bytes: bs58.encode(Buffer.from(glAccountDiscriminator)),
          },
        });
      }

      // Query accounts with discriminator + ledger memcmp filters
      const accounts = await provider.connection.getProgramAccounts(program.programId, {
        filters,
      });

      const glAccounts: GlAccount[] = [];

      for (const account of accounts) {
        try {
          // Try Anchor coder first; fall back to manual binary decode on any error
          // (Anchor 0.32 coder may fail with "Account not found" due to camelCase normalization)
          let decoded: ReturnType<typeof this.tryDecodeGlAccountManual>;
          try {
            const coderDecoded = program.coder.accounts.decode("GlAccount", account.account.data);
            decoded = {
              ledger: coderDecoded.ledger as PublicKey,
              code: coderDecoded.code as number,
              name: coderDecoded.name as string,
              category: coderDecoded.category as number,
              normalSide: coderDecoded.normalSide as number,
              balance: coderDecoded.balance as bigint,
              bump: coderDecoded.bump as number,
            };
          } catch {
            decoded = this.tryDecodeGlAccountManual(account.account.data);
          }

          if (!decoded) {
            console.warn("[listGlAccounts] Could not decode account:", account.pubkey.toBase58());
            continue;
          }

          glAccounts.push({
            publicKey: account.pubkey,
            account: {
              ledger: decoded.ledger,
              code: decoded.code,
              name: decoded.name,
              category: this.mapCategory(decoded.category),
              normalSide: this.mapNormalSide(decoded.normalSide),
              balance: decoded.balance,
              bump: decoded.bump,
            },
          });
        } catch (decodeErr) {
          console.error("[listGlAccounts] Unexpected error for account:", account.pubkey.toBase58(), decodeErr);
          continue;
        }
      }

      return glAccounts.sort((a, b) => a.account.code - b.account.code);
    } catch (err) {
      console.error("Error listing GL accounts:", err);
      return [];
    }
  }

  /**
   * Get a specific GL account
   */
  async getGlAccount(ledgerKey: PublicKey, code: number): Promise<GlAccount | null> {
    try {
      const program = await this.getProgram();
      const provider = getProvider() as AnchorProvider;

      const [glAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(GL_ACCOUNT_SEED), ledgerKey.toBuffer(), Buffer.from(new Uint32Array([code]).buffer)],
        program.programId,
      );

      const account = await provider.connection.getAccountInfo(glAccountPda);
      if (!account) return null;

      let decoded: ReturnType<typeof this.tryDecodeGlAccountManual>;
      try {
        const coderDecoded = program.coder.accounts.decode("GlAccount", account.data);
        decoded = {
          ledger: coderDecoded.ledger as PublicKey,
          code: coderDecoded.code as number,
          name: coderDecoded.name as string,
          category: coderDecoded.category as number,
          normalSide: coderDecoded.normalSide as number,
          balance: coderDecoded.balance as bigint,
          bump: coderDecoded.bump as number,
        };
      } catch {
        decoded = this.tryDecodeGlAccountManual(account.data);
      }

      if (!decoded) return null;

      return {
        publicKey: glAccountPda,
        account: {
          ledger: decoded.ledger,
          code: decoded.code,
          name: decoded.name,
          category: this.mapCategory(decoded.category),
          normalSide: this.mapNormalSide(decoded.normalSide),
          balance: decoded.balance,
          bump: decoded.bump,
        },
      };
    } catch (err) {
      console.error(`Error fetching GL account ${code}:`, err);
      return null;
    }
  }

  /**
   * List all journal entries for a ledger
   */
  async listJournalEntries(ledgerKey: PublicKey): Promise<JournalEntry[]> {
    try {
      const program = await this.getProgram();
      const provider = getProvider() as AnchorProvider;

      // Get JournalEntry discriminator to filter only JournalEntry-type accounts
      const runtimeIdl = this.getRuntimeIdl() as typeof accountingEngineIdl;
      const journalEntryDiscriminator = (runtimeIdl as { accounts?: Array<{ name: string; discriminator?: number[] }> }).accounts
        ?.find((a) => a.name === "JournalEntry")?.discriminator;

      const filters: { memcmp: { offset: number; bytes: string } }[] = [
        {
          memcmp: {
            offset: 8, // Skip discriminator; ledger field starts at byte 8
            bytes: ledgerKey.toBase58(),
          },
        },
      ];

      if (journalEntryDiscriminator) {
        filters.unshift({
          memcmp: {
            offset: 0,
            bytes: bs58.encode(Buffer.from(journalEntryDiscriminator)),
          },
        });
      }

      const accounts = await provider.connection.getProgramAccounts(program.programId, {
        filters,
      });

      const journalEntries: JournalEntry[] = [];

      for (const account of accounts) {
        try {
          // Anchor 0.32 coder registers account types as camelCase ("journalEntry" not "JournalEntry")
          const decoded = program.coder.accounts.decode("journalEntry", account.account.data);
          journalEntries.push({
            publicKey: account.pubkey,
            account: {
              ledger: decoded.ledger,
              entryId: decoded.entryId,
              externalRef: decoded.externalRef,
              memo: decoded.memo,
              totalDebit: decoded.totalDebit,
              totalCredit: decoded.totalCredit,
              lineCount: decoded.lineCount,
              postedAt: decoded.postedAt,
              bump: decoded.bump,
            },
          });
        } catch {
          // Skip accounts that fail to decode
          continue;
        }
      }

      return journalEntries.sort((a, b) => Number(b.account.entryId) - Number(a.account.entryId));
    } catch (err) {
      console.error("Error listing journal entries:", err);
      return [];
    }
  }

  /**
   * Get a specific journal entry
   */
  async getJournalEntry(ledgerKey: PublicKey, entryId: bigint): Promise<JournalEntry | null> {
    try {
      // Query for journal entry with matching entry_id
      // Compare via toString() to handle both BN (Anchor runtime) and native bigint
      const entries = await this.listJournalEntries(ledgerKey);
      return entries.find((e) => e.account.entryId.toString() === entryId.toString()) || null;
    } catch (err) {
      console.error(`Error fetching journal entry ${entryId}:`, err);
      return null;
    }
  }

  /**
   * Get posting lines for a journal entry (from Supabase)
   */
  async getJournalEntryPostingLines(
    ledgerId: string,
    entryId: bigint,
    token: string,
  ): Promise<PostingLine[]> {
    try {
      const response = await fetch(`/api/accounting/posting-lines?ledgerId=${ledgerId}&entryId=${entryId}`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch posting lines");
      }

      const data = (await response.json()) as {
        lines?: Array<{ accountCode: number; amount: string | number; isDebit: boolean }>;
        error?: string;
      };
      return (data.lines ?? []).map((line) => ({
        accountCode: line.accountCode,
        amount: BigInt(line.amount),
        isDebit: line.isDebit,
      }));
    } catch (err) {
      console.error("Error fetching posting lines:", err);
      return [];
    }
  }

  /**
   * Save posting lines for a journal entry (to Supabase off-chain store)
   */
  async saveJournalEntryPostingLines(
    ledgerId: string,
    entryId: bigint,
    postingLines: PostingLine[],
    token: string,
  ): Promise<void> {
    try {
      const response = await fetch("/api/accounting/posting-lines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ledgerId,
          entryId: entryId.toString(),
          postingLines: postingLines.map((line) => ({
            accountCode: line.accountCode,
            amount: line.amount.toString(),
            isDebit: line.isDebit,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save posting lines");
      }
    } catch (err) {
      console.error("Error saving posting lines:", err);
      throw err;
    }
  }

  /**
   * List accounting ledgers for a specific authority.
   */
  async listLedgersByAuthority(authority: PublicKey): Promise<AccountingLedger[]> {
    try {
      const program = await this.getProgram();
      const provider = getProvider() as AnchorProvider;
      const glConfigDiscriminator = this.getGlConfigDiscriminator();

      if (!glConfigDiscriminator) {
        console.error("GlConfig discriminator not found in accounting engine IDL");
        return [];
      }

      let accounts = await provider.connection.getProgramAccounts(program.programId, {
        filters: [
          {
            memcmp: {
              offset: 0,
                bytes: bs58.encode(glConfigDiscriminator),
            },
          },
          {
            memcmp: {
              offset: 8, // Skip discriminator; authority is first field
              bytes: authority.toBase58(),
            },
          },
        ],
      });

      // Fallback: if RPC-side authority memcmp misses results, scan only GlConfig accounts.
      if (accounts.length === 0) {
        accounts = await provider.connection.getProgramAccounts(program.programId, {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: bs58.encode(glConfigDiscriminator),
              },
            },
          ],
        });
      }

      const ledgers: AccountingLedger[] = [];

      for (const account of accounts) {
        try {
          const decoded = this.tryDecodeCurrentGlConfig(program, account.account.data);
          if (!decoded) {
            continue;
          }
          const decodedAuthority = (decoded.authority as PublicKey | undefined) ?? PublicKey.default;
          const decodedLedgerCode =
            (decoded.ledgerCode as string | undefined) ??
            (decoded.ledger_code as string | undefined) ??
            "";
          const decodedJournalEntryCount =
            (decoded.journalEntryCount as bigint | undefined) ??
            (decoded.journal_entry_count as bigint | undefined) ??
            BigInt(0);
          const decodedBump =
            (decoded.bump as number | undefined) ??
            0;

          if (!decodedAuthority.equals(authority)) {
            continue;
          }

          ledgers.push({
            publicKey: account.pubkey,
            account: {
              authority: decodedAuthority,
              ledgerCode: decodedLedgerCode,
              journalEntryCount: decodedJournalEntryCount,
              bump: decodedBump,
            },
          });
        } catch {
          // Skip non-ledger account types
          continue;
        }
      }

      return ledgers.sort((a, b) => (a.account.ledgerCode || "").localeCompare(b.account.ledgerCode || ""));
    } catch (err) {
      console.error("Error listing accounting ledgers:", err);
      return [];
    }
  }

  /**
   * Fetch a specific accounting ledger by pubkey.
   */
  async getLedger(pubkey: PublicKey): Promise<AccountingLedger | null> {
    try {
      const program = await this.getProgram();
      const provider = getProvider() as AnchorProvider;
      const accountInfo = await provider.connection.getAccountInfo(pubkey, "confirmed");
      if (!accountInfo) return null;

      const decoded = this.tryDecodeCurrentGlConfig(program, accountInfo.data);
      if (!decoded) return null;
      const decodedAuthority = (decoded.authority as PublicKey | undefined) ?? PublicKey.default;
      const decodedLedgerCode =
        (decoded.ledgerCode as string | undefined) ??
        (decoded.ledger_code as string | undefined) ??
        "";
      const decodedJournalEntryCount =
        (decoded.journalEntryCount as bigint | undefined) ??
        (decoded.journal_entry_count as bigint | undefined) ??
        BigInt(0);
      const decodedBump = (decoded.bump as number | undefined) ?? 0;

      return {
        publicKey: pubkey,
        account: {
          authority: decodedAuthority,
          ledgerCode: decodedLedgerCode,
          journalEntryCount: decodedJournalEntryCount,
          bump: decodedBump,
        },
      };
    } catch {
      return null;
    }
  }

  async getLedgerDiscoveryDebug(authority: PublicKey): Promise<AccountingLedgerDiscoveryDebug> {
    const program = await this.getProgram();
    const provider = getProvider() as AnchorProvider;
    const glConfigDiscriminator = this.getGlConfigDiscriminator();

    if (!glConfigDiscriminator) {
      return {
        programId: program.programId.toBase58(),
        authority: authority.toBase58(),
        memcmpHits: 0,
        scannedAccounts: 0,
        decodedLedgerConfigs: 0,
        authorityMatches: 0,
      };
    }

    const memcmpAccounts = await provider.connection.getProgramAccounts(program.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(glConfigDiscriminator),
          },
        },
        {
          memcmp: {
            offset: 8,
            bytes: authority.toBase58(),
          },
        },
      ],
    });

    const allAccounts = await provider.connection.getProgramAccounts(program.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(glConfigDiscriminator),
          },
        },
      ],
    });
    let decodedLedgerConfigs = 0;
    let authorityMatches = 0;

    for (const account of allAccounts) {
      try {
        const decoded = this.tryDecodeCurrentGlConfig(program, account.account.data);
        if (!decoded) {
          continue;
        }
        decodedLedgerConfigs += 1;
        const decodedAuthority = (decoded.authority as PublicKey | undefined) ?? PublicKey.default;
        if (decodedAuthority.equals(authority)) {
          authorityMatches += 1;
        }
      } catch {
        continue;
      }
    }

    return {
      programId: program.programId.toBase58(),
      authority: authority.toBase58(),
      memcmpHits: memcmpAccounts.length,
      scannedAccounts: allAccounts.length,
      decodedLedgerConfigs,
      authorityMatches,
    };
  }

  /**
   * Manually decode a GlAccount from raw account data, bypassing Anchor coder version quirks.
   * GlAccount on-chain layout (after 8-byte discriminator):
   *   ledger:      Pubkey  (32 bytes)
   *   code:        u32     (4 bytes LE)
   *   name:        String  (4-byte length prefix + UTF-8 bytes)
   *   category:    u8      (AccountCategory #[repr(u8)]: Asset=1,Liability=2,Equity=3,Revenue=4,Expense=5)
   *   normal_side: u8      (NormalSide #[repr(u8)]: Debit=1, Credit=2)
   *   balance:     i128    (16 bytes LE)
   *   bump:        u8      (1 byte)
   */
  private tryDecodeGlAccountManual(data: Buffer): {
    ledger: PublicKey;
    code: number;
    name: string;
    category: number;
    normalSide: number;
    balance: bigint;
    bump: number;
  } | null {
    try {
      let offset = 8; // skip discriminator
      if (data.length < offset + 32 + 4) return null;

      const ledger = new PublicKey(data.subarray(offset, offset + 32));
      offset += 32;

      const code = data.readUInt32LE(offset);
      offset += 4;

      if (data.length < offset + 4) return null;
      const nameLen = data.readUInt32LE(offset);
      offset += 4;

      if (data.length < offset + nameLen) return null;
      const name = data.subarray(offset, offset + nameLen).toString("utf8");
      offset += nameLen;

      if (data.length < offset + 2 + 16 + 1) return null;
      const category = data.readUInt8(offset);
      offset += 1;

      const normalSide = data.readUInt8(offset);
      offset += 1;

      // i128 as 16 bytes little-endian
      const lo = data.readBigUInt64LE(offset);
      const hiSigned = data.readBigInt64LE(offset + 8);
      const balance = (hiSigned << 64n) | lo;
      offset += 16;

      const bump = data.readUInt8(offset);

      return { ledger, code, name, category, normalSide, balance, bump };
    } catch {
      return null;
    }
  }

  private mapCategory(
    category: unknown,
  ): "Asset" | "Liability" | "Equity" | "Revenue" | "Expense" {
    // Anchor 0.30+ IDL format decodes enums as objects e.g. { asset: {} }
    if (typeof category === "object" && category !== null) {
      const key = Object.keys(category as object)[0]?.toLowerCase();
      const objMap: Record<string, "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"> = {
        asset: "Asset",
        liability: "Liability",
        equity: "Equity",
        revenue: "Revenue",
        expense: "Expense",
      };
      return objMap[key] ?? "Asset";
    }
    // Fallback: raw u8 from #[repr(u8)] explicit discriminants (Asset=1..Expense=5)
    // Also handle 0-based Borsh index as a last resort
    const numMap: Record<number, "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"> = {
      // 1-based (#[repr(u8)] explicit values)
      1: "Asset",
      2: "Liability",
      3: "Equity",
      4: "Revenue",
      5: "Expense",
      // 0-based Borsh variant index fallback
      0: "Asset",
    };
    return numMap[category as number] ?? "Asset";
  }

  private mapNormalSide(normalSide: unknown): "Debit" | "Credit" {
    // Anchor 0.30+ IDL format decodes enums as objects e.g. { debit: {} }
    if (typeof normalSide === "object" && normalSide !== null) {
      const key = Object.keys(normalSide as object)[0]?.toLowerCase();
      return key === "credit" ? "Credit" : "Debit";
    }
    // Raw u8: #[repr(u8)] Debit=1, Credit=2; or Borsh 0-based Debit=0, Credit=1
    return (normalSide as number) === 2 ? "Credit" : "Debit";
  }

  isAccountDecodeRangeError(err: unknown): boolean {
    if (err instanceof Error) {
      return (
        err.message.includes("Trying to access beyond buffer length") ||
        err.message.includes("RangeError") ||
        err.message.includes("buffer")
      );
    }
    return false;
  }
}

export const accountingEngineService = new AccountingEngineService();
