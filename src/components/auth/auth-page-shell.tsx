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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7f4ed,transparent_35%),radial-gradient(circle_at_bottom_right,#e8eef9,transparent_40%)] p-4">
      {loading ? (
        <div className="mx-auto mt-24 max-w-sm rounded-lg border border-slate-200 bg-white p-5 text-center text-xs text-slate-500">
          Checking session...
        </div>
      ) : (
        children
      )}
    </div>
  );
}
