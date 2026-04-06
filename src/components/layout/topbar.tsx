"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { clampText } from "@/lib/utils/format";

export function Topbar() {
  const { user, signOut } = useAuth();
  const { workspaces, selectedWorkspaceId, selectWorkspace, role, createWorkspace } = useWorkspace();
  const { wallet } = useEmbeddedWallet();
  const [newWorkspace, setNewWorkspace] = useState("");
  const [copied, setCopied] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const canManageWorkspace = role === "admin";
  const walletAddress = wallet?.publicKey.toBase58() ?? "";

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const copyWalletAddress = async () => {
    if (!walletAddress || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
            value={selectedWorkspaceId ?? ""}
            onChange={(event) => selectWorkspace(event.target.value || null)}
          >
            <option value="">Select workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>

          <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-900">
            {role}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canManageWorkspace ? (
            <>
              <Input
                label=""
                placeholder="New workspace"
                value={newWorkspace}
                className="w-44"
                onChange={(event) => setNewWorkspace(event.target.value)}
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!newWorkspace.trim()) return;
                  try {
                    setWorkspaceError(null);
                    await createWorkspace(newWorkspace.trim());
                    setNewWorkspace("");
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : "Failed to create workspace.";
                    setWorkspaceError(message);
                  }
                }}
              >
                Create
              </Button>
            </>
          ) : null}
          <Link
            href="/app/configuration#create-wallet"
            className="inline-flex items-center justify-center rounded-md bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Wallet Settings
          </Link>
          <button
            type="button"
            title={walletAddress || "No wallet"}
            onClick={() => {
              void copyWalletAddress();
            }}
            disabled={!walletAddress}
            className="group relative inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-600 transition hover:bg-slate-200 disabled:cursor-default disabled:hover:bg-slate-100"
          >
            <span>{walletAddress ? clampText(walletAddress, 20) : "No wallet"}</span>
            {walletAddress ? (
              <span className="opacity-0 transition group-hover:opacity-100">
                {copied ? "Copied" : "Copy"}
              </span>
            ) : null}
          </button>
          <p className="hidden rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-600 md:block">
            {user?.email ? clampText(user.email, 20) : "anonymous"}
          </p>
          <Button
            variant="danger"
            onClick={async () => {
              await signOut();
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
      {workspaceError ? (
        <div className="border-t border-rose-200 bg-rose-50 px-4 py-1.5 text-[11px] text-rose-700">
          {workspaceError}
        </div>
      ) : null}
    </header>
  );
}
