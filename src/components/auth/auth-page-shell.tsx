"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/app");
    }
  }, [loading, router, user]);

  return (
    <div className="min-h-screen p-4">
      {loading ? (
        <div className="mx-auto mt-24 max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-center text-xs text-slate-500">
          Checking session...
        </div>
      ) : (
        children
      )}
    </div>
  );
}
