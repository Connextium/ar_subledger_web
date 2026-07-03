import { apiFetch } from "@/lib/api-client/v1/http";

export type PostingLine = {
  accountCode?: number;
  amount?: string;
  isDebit?: boolean;
};

export type PostingDelegateStatus = {
  active?: boolean;
  postingDelegatePubkey?: string;
  delegate?: string;
};

export type GlAccount = {
  account: {
    code: number;
    name: string;
    category: string;
    normalSide: string;
    balance: bigint;
  };
  code?: number;
  name?: string;
  pubkey?: string;
};

export type JournalEntry = {
  publicKey: {
    toBase58: () => string;
  };
  account: {
    entryId: bigint;
    ledger: {
      toBase58: () => string;
    };
    postedAt: bigint;
    externalRef: string;
    memo: string;
    totalDebit: bigint;
    totalCredit: bigint;
    lineCount: number;
  };
  entryId?: string;
  pubkey?: string;
};

export type AccountingLedgerDiscoveryDebug = {
  programId: string;
  memcmpHits: number;
  scannedAccounts: number;
  decodedLedgerConfigs: number;
  authorityMatches: number;
};

export type AccountingLedger = {
  account: {
    ledgerCode: string;
  };
  publicKey: {
    toBase58: () => string;
  };
  pubkey?: string;
  authority?: string;
  ledgerCode?: string;
  nextJournalEntryId?: number;
};

type WorkspaceLedgerSourceRow = {
  authority?: unknown;
  ledgerCode?: unknown;
  accountingLedger?: unknown;
  authorityPubkey?: unknown;
  authority_pubkey?: unknown;
  ledger_code?: unknown;
  accountingLedgerPubkey?: unknown;
  accounting_ledger?: unknown;
  onchainLedgerKey?: unknown;
  onchain_ledger_key?: unknown;
  account?: {
    ledgerCode?: unknown;
  };
};

function toBase58Like(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === "object" && "toBase58" in value) {
    const toBase58 = (value as { toBase58?: unknown }).toBase58;
    if (typeof toBase58 === "function") {
      try {
        const resolved = toBase58.call(value);
        if (typeof resolved === "string" && resolved.trim().length > 0) {
          return resolved.trim();
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

function normalizeAuthority(value: unknown): string | null {
  const resolved = toBase58Like(value);
  if (!resolved) {
    return null;
  }

  const fromWrapper = /^PublicKey\(([^)]+)\)$/.exec(resolved);
  return fromWrapper?.[1] ?? resolved;
}

function resolveLedgerPubkey(row: WorkspaceLedgerSourceRow): string | null {
  const candidates: unknown[] = [
    (row as { pubkey?: unknown }).pubkey,
    (row as { publicKey?: unknown }).publicKey,
    row.accountingLedger,
    row.accountingLedgerPubkey,
    row.accounting_ledger,
    row.onchainLedgerKey,
    row.onchain_ledger_key,
  ];

  for (const candidate of candidates) {
    const resolved = toBase58Like(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function resolveLedgerCode(row: WorkspaceLedgerSourceRow): string {
  const candidate =
    (typeof row.ledgerCode === "string" && row.ledgerCode) ||
    (typeof row.ledger_code === "string" && row.ledger_code) ||
    (typeof row.account?.ledgerCode === "string" && row.account.ledgerCode) ||
    "";

  return candidate;
}

function resolveAuthority(row: WorkspaceLedgerSourceRow): string | null {
  return normalizeAuthority(row.authority) ?? normalizeAuthority(row.authorityPubkey) ?? normalizeAuthority(row.authority_pubkey);
}

function workspacePath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/accounting/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
}

function supplierWorkspacePath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/supplier/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
}

function accountingLedgerPath(workspaceId: string, ledgerPubkey: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/accounting/workspaces/${encodeURIComponent(workspaceId)}/ledgers/${encodeURIComponent(ledgerPubkey)}${normalized}`;
}

const WORKSPACE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isWorkspaceId(value: string): boolean {
  return WORKSPACE_ID_PATTERN.test(value.trim());
}

function toBigIntLike(value: unknown, fallback = 0n): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function resolveWorkspaceIdFromBrowserContext(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fromQuery = new URL(window.location.href).searchParams.get("workspace")?.trim();
  if (fromQuery) {
    return fromQuery;
  }

  const raw = window.sessionStorage.getItem("ar:working-context");
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { workspaceId?: unknown };
    return typeof parsed.workspaceId === "string" && parsed.workspaceId.length > 0 ? parsed.workspaceId : null;
  } catch {
    return null;
  }
}

function pickWorkspaceId(args: unknown[]): string | null {
  for (const arg of args) {
    if (typeof arg === "string" && arg.length > 0 && isWorkspaceId(arg)) {
      return arg;
    }
    if (arg && typeof arg === "object" && "workspaceId" in arg) {
      const workspaceId = (arg as { workspaceId?: unknown }).workspaceId;
      if (typeof workspaceId === "string" && workspaceId.length > 0) {
        return workspaceId;
      }
    }
  }

  return resolveWorkspaceIdFromBrowserContext();
}

function pickStringArg(args: unknown[], ignore: string | null = null): string | null {
  const value = args.find((arg) => typeof arg === "string" && arg !== ignore);
  return typeof value === "string" ? value : null;
}

async function listWorkspaceBaseGlCandidates(workspaceId: string): Promise<WorkspaceLedgerSourceRow[]> {
  const [supplierResult, buyerResult] = await Promise.allSettled([
    apiFetch(supplierWorkspacePath(workspaceId, "/ledgers")),
    apiFetch(workspacePath(workspaceId, "/ledgers")),
  ]);

  const supplierPayload =
    supplierResult.status === "fulfilled" && supplierResult.value && typeof supplierResult.value === "object"
      ? (supplierResult.value as { ledgers?: Array<Record<string, unknown>> })
      : { ledgers: [] };
  const buyerPayload =
    buyerResult.status === "fulfilled" && buyerResult.value && typeof buyerResult.value === "object"
      ? (buyerResult.value as { ledgers?: Array<Record<string, unknown>> })
      : { ledgers: [] };

  const supplierRows = Array.isArray(supplierPayload.ledgers) ? supplierPayload.ledgers : [];
  const buyerRows = Array.isArray(buyerPayload.ledgers) ? buyerPayload.ledgers : [];
  return [...supplierRows, ...buyerRows];
}

export const accountingEngineService = {
  async initializeLedger(...args: unknown[]): Promise<string> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) {
      return pickStringArg(args) ?? "";
    }
    const body = (args.find((value) => value && typeof value === "object") as Record<string, unknown> | undefined) ?? {};
    const payload = (await apiFetch(workspacePath(workspaceId, "/initialize-gl"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;

    const candidate =
      payload.pubkey ??
      payload.ledgerPubkey ??
      payload.onchainLedgerKey ??
      (payload.ledger && typeof payload.ledger === "object"
        ? (payload.ledger as Record<string, unknown>).pubkey
        : undefined);
    return typeof candidate === "string" ? candidate : "";
  },

  async getJournalEntryPostingLines(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    const ledgerId = pickStringArg(args, workspaceId);
    const entryId = pickStringArg(args, ledgerId);
    if (!ledgerId || !entryId) return [];
    const qs = new URLSearchParams({ ledgerId, entryId });
    const payload = (await apiFetch(`${workspacePath(workspaceId, "/posting-lines")}?${qs.toString()}`)) as { lines?: PostingLine[] };
    return payload.lines ?? [];
  },

  async saveJournalEntryPostingLines(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return { success: false };
    const input =
      (args.find((value) => value && typeof value === "object") as
        | { ledgerId: string; entryId: string; postingLines: PostingLine[] }
        | undefined) ?? { ledgerId: "", entryId: "", postingLines: [] };
    return apiFetch(workspacePath(workspaceId, "/posting-lines"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async listLedgersByAuthority(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [] as AccountingLedger[];

    const authorityFromObject = args.find(
      (arg) => arg && typeof arg === "object" && "authority" in arg,
    ) as { authority?: unknown } | undefined;

    const authority =
      authorityFromObject?.authority ??
      args.find((arg) => {
        if (typeof arg === "string") return true;
        if (arg && typeof arg === "object" && "toBase58" in arg && typeof (arg as { toBase58?: unknown }).toBase58 === "function") {
          return true;
        }
        return false;
      }) ?? null;

    const authorityBase58Raw =
      typeof authority === "string"
        ? authority
        : authority && typeof authority === "object" && "toBase58" in authority && typeof (authority as { toBase58: () => string }).toBase58 === "function"
          ? (authority as { toBase58: () => string }).toBase58()
          : null;
    const authorityBase58 = normalizeAuthority(authorityBase58Raw);

    const dedup = new Map<string, AccountingLedger>();

    const appendLedger = (ledger: AccountingLedger) => {
      const key = ledger.pubkey;
      if (typeof key !== "string" || key.length === 0) {
        return;
      }
      if (!dedup.has(key)) {
        dedup.set(key, ledger);
      }
    };

    try {
      const qs = new URLSearchParams();
      if (authorityBase58) {
        qs.set("authority", authorityBase58);
      }
      const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
      const payload = (await apiFetch(workspacePath(workspaceId, `/ledgers${suffix}`))) as {
        ledgers?: Array<{
          pubkey?: string;
          authority?: string;
          ledgerCode?: string;
          nextJournalEntryId?: number | string;
        }>;
      };
      const rows = Array.isArray(payload.ledgers) ? payload.ledgers : [];
      rows
        .filter((row) => typeof row.pubkey === "string" && row.pubkey.length > 0)
        .forEach((row) => {
          const pubkey = row.pubkey as string;
          const ledgerCode = typeof row.ledgerCode === "string" ? row.ledgerCode : "";
          const nextJournalEntryIdRaw = row.nextJournalEntryId;
          const nextJournalEntryId =
            typeof nextJournalEntryIdRaw === "number"
              ? nextJournalEntryIdRaw
              : typeof nextJournalEntryIdRaw === "string"
                ? Number(nextJournalEntryIdRaw)
                : undefined;

          appendLedger({
            pubkey,
            authority: typeof row.authority === "string" ? row.authority : authorityBase58 ?? undefined,
            ledgerCode,
            nextJournalEntryId,
            account: {
              ledgerCode,
            },
            publicKey: {
              toBase58: () => pubkey,
            },
          } as AccountingLedger);
        });
    } catch {
      // Fall back to legacy buyer/supplier aggregation path.
    }

    const rows = await listWorkspaceBaseGlCandidates(workspaceId);
    const filtered = authorityBase58 ? rows.filter((row) => resolveAuthority(row) === authorityBase58) : rows;
    for (const row of filtered) {
      const glPubkey = resolveLedgerPubkey(row) ?? "";
      if (!glPubkey) continue;

      const ledgerCode = resolveLedgerCode(row);
      appendLedger({
        pubkey: glPubkey,
        ledgerCode,
        account: {
          ledgerCode,
        },
        publicKey: {
          toBase58: () => glPubkey,
        },
      } as AccountingLedger);
    }

    return Array.from(dedup.values());
  },

  async getLedger(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const glPubkey = pickStringArg(args, workspaceId);
    if (!glPubkey) return null as AccountingLedger | null;

    if (!workspaceId) {
      return {
        pubkey: glPubkey,
        ledgerCode: glPubkey,
        account: {
          ledgerCode: glPubkey,
        },
        publicKey: {
          toBase58: () => glPubkey,
        },
      } as AccountingLedger;
    }

    const rows = await listWorkspaceBaseGlCandidates(workspaceId);
    const row = rows.find((candidate) => resolveLedgerPubkey(candidate) === glPubkey);

    if (!row) {
      // Fallback to authority/workspace scoped listing when candidate aggregation misses direct pubkey rows.
      const ledgers = await this.listLedgersByAuthority({ workspaceId });
      const fallback = ledgers.find((ledger) => ledger.pubkey === glPubkey) ?? null;
      if (fallback) {
        return fallback;
      }

      return null as AccountingLedger | null;
    }

    const ledgerCode = resolveLedgerCode(row);
    const authority = resolveAuthority(row) ?? undefined;

    return {
      pubkey: glPubkey,
      authority,
      ledgerCode,
      account: {
        ledgerCode,
      },
      publicKey: {
        toBase58: () => glPubkey,
      },
    } as AccountingLedger;
  },

  async getLedgerDiscoveryDebug(..._args: unknown[]) {
    return {
      programId: "",
      memcmpHits: 0,
      scannedAccounts: 0,
      decodedLedgerConfigs: 0,
      authorityMatches: 0,
    } as AccountingLedgerDiscoveryDebug;
  },

  async listGlAccounts(..._args: unknown[]) {
    const workspaceId = pickWorkspaceId(_args);
    const ledgerPubkey = pickStringArg(_args, workspaceId);
    if (!workspaceId || !ledgerPubkey) return [] as GlAccount[];

    const payload = (await apiFetch(accountingLedgerPath(workspaceId, ledgerPubkey, "/gl-accounts"))) as {
      glAccounts?: Array<{
        pubkey?: unknown;
        code?: unknown;
        name?: unknown;
        category?: unknown;
        normalSide?: unknown;
        balance?: unknown;
      }>;
    };

    const rows = Array.isArray(payload.glAccounts) ? payload.glAccounts : [];
    return rows.map((row) => {
      const pubkey = typeof row.pubkey === "string" ? row.pubkey : "";
      const code = typeof row.code === "number" ? row.code : Number(row.code ?? 0);
      const name = typeof row.name === "string" ? row.name : "";
      const category = typeof row.category === "string" ? row.category : "Asset";
      const normalSide = typeof row.normalSide === "string" ? row.normalSide : "Debit";
      const balance = toBigIntLike(row.balance, 0n);

      return {
        pubkey,
        code,
        name,
        account: {
          code,
          name,
          category,
          normalSide,
          balance,
        },
      } as GlAccount;
    });
  },

  async listJournalEntries(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const ledgerPubkey = pickStringArg(args, workspaceId);
    if (!workspaceId || !ledgerPubkey) return [] as JournalEntry[];

    const payload = (await apiFetch(accountingLedgerPath(workspaceId, ledgerPubkey, "/journal-entries"))) as {
      journalEntries?: Array<{
        pubkey?: unknown;
        entryId?: unknown;
        postedAt?: unknown;
        externalRef?: unknown;
        memo?: unknown;
        totalDebit?: unknown;
        totalCredit?: unknown;
        lineCount?: unknown;
      }>;
    };

    const rows = Array.isArray(payload.journalEntries) ? payload.journalEntries : [];
    return rows.map((row) => {
      const pubkey = typeof row.pubkey === "string" ? row.pubkey : "";
      const entryId = toBigIntLike(row.entryId, 0n);
      const postedAt = toBigIntLike(row.postedAt, 0n);
      const externalRef = typeof row.externalRef === "string" ? row.externalRef : "";
      const memo = typeof row.memo === "string" ? row.memo : "";
      const totalDebit = toBigIntLike(row.totalDebit, 0n);
      const totalCredit = toBigIntLike(row.totalCredit, 0n);
      const lineCount = typeof row.lineCount === "number" ? row.lineCount : Number(row.lineCount ?? 0);

      return {
        pubkey,
        entryId: entryId.toString(),
        publicKey: {
          toBase58: () => pubkey,
        },
        account: {
          entryId,
          ledger: {
            toBase58: () => ledgerPubkey,
          },
          postedAt,
          externalRef,
          memo,
          totalDebit,
          totalCredit,
          lineCount,
        },
      } as JournalEntry;
    });
  },

  async getJournalEntry(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const ledgerPubkey = pickStringArg(args, workspaceId);
    const entryArg = args.find((arg) => arg !== workspaceId && arg !== ledgerPubkey);
    const entryId = toBigIntLike(entryArg, -1n);

    if (!workspaceId || !ledgerPubkey || entryId < 0n) {
      return null as JournalEntry | null;
    }

    const qs = new URLSearchParams({ entryId: entryId.toString() });
    const payload = (await apiFetch(
      `${accountingLedgerPath(workspaceId, ledgerPubkey, "/journal-entries")}?${qs.toString()}`,
    )) as {
      journalEntry?: {
        pubkey?: unknown;
        entryId?: unknown;
        postedAt?: unknown;
        externalRef?: unknown;
        memo?: unknown;
        totalDebit?: unknown;
        totalCredit?: unknown;
        lineCount?: unknown;
      } | null;
    };

    const row = payload.journalEntry;
    if (!row || typeof row !== "object") {
      return null as JournalEntry | null;
    }

    const pubkey = typeof row.pubkey === "string" ? row.pubkey : "";
    const resolvedEntryId = toBigIntLike(row.entryId, entryId);
    const postedAt = toBigIntLike(row.postedAt, 0n);
    const externalRef = typeof row.externalRef === "string" ? row.externalRef : "";
    const memo = typeof row.memo === "string" ? row.memo : "";
    const totalDebit = toBigIntLike(row.totalDebit, 0n);
    const totalCredit = toBigIntLike(row.totalCredit, 0n);
    const lineCount = typeof row.lineCount === "number" ? row.lineCount : Number(row.lineCount ?? 0);

    return {
      pubkey,
      entryId: resolvedEntryId.toString(),
      publicKey: {
        toBase58: () => pubkey,
      },
      account: {
        entryId: resolvedEntryId,
        ledger: {
          toBase58: () => ledgerPubkey,
        },
        postedAt,
        externalRef,
        memo,
        totalDebit,
        totalCredit,
        lineCount,
      },
    } as JournalEntry;
  },

  async authorizePostingDelegate(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const ledgerPubkey = pickStringArg(args, workspaceId);
    const facilitator = pickStringArg(args, ledgerPubkey)?.trim() ?? "";

    if (!workspaceId || !ledgerPubkey || facilitator.length === 0) {
      throw new Error("workspaceId, ledgerPubkey, and facilitator are required");
    }

    const payload = (await apiFetch(accountingLedgerPath(workspaceId, ledgerPubkey, "/posting-delegate"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ facilitator }),
    })) as { signature?: unknown };

    if (typeof payload.signature !== "string" || payload.signature.length === 0) {
      throw new Error("Failed to authorize posting delegate");
    }

    return payload.signature;
  },

  async revokePostingDelegate(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const ledgerPubkey = pickStringArg(args, workspaceId);
    const facilitator = pickStringArg(args, ledgerPubkey)?.trim() ?? "";

    if (!workspaceId || !ledgerPubkey || facilitator.length === 0) {
      throw new Error("workspaceId, ledgerPubkey, and facilitator are required");
    }

    const payload = (await apiFetch(accountingLedgerPath(workspaceId, ledgerPubkey, "/posting-delegate"), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ facilitator }),
    })) as { signature?: unknown };

    if (typeof payload.signature !== "string" || payload.signature.length === 0) {
      throw new Error("Failed to revoke posting delegate");
    }

    return payload.signature;
  },

  async getPostingDelegateStatus(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const ledgerPubkey = pickStringArg(args, workspaceId);
    const facilitator = pickStringArg(args, ledgerPubkey)?.trim() ?? "";

    if (!workspaceId || !ledgerPubkey || facilitator.length === 0) {
      return { active: false } as PostingDelegateStatus;
    }

    const qs = new URLSearchParams({ facilitator });
    const payload = (await apiFetch(
      `${accountingLedgerPath(workspaceId, ledgerPubkey, "/posting-delegate")}?${qs.toString()}`,
    )) as {
      status?: {
        postingDelegatePubkey?: unknown;
        ledger?: unknown;
        authority?: unknown;
        delegate?: unknown;
        active?: unknown;
      };
    };

    const status = payload.status;
    if (!status || typeof status !== "object") {
      return { active: false } as PostingDelegateStatus;
    }

    return {
      postingDelegatePubkey:
        typeof status.postingDelegatePubkey === "string" ? status.postingDelegatePubkey : undefined,
      ledger: typeof status.ledger === "string" ? status.ledger : undefined,
      authority: typeof status.authority === "string" ? status.authority : undefined,
      delegate: typeof status.delegate === "string" ? status.delegate : undefined,
      active: Boolean(status.active),
    } as PostingDelegateStatus;
  },
};
