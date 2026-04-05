"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLogin = mode === "login";

  return (
    <div className="mx-auto mt-20 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">AR Suite</p>
      <h1 className="mt-1 text-sm font-semibold text-slate-900">
        {isLogin ? "Sign In" : "Create Account"}
      </h1>
      <p className="mt-1 text-[11px] text-slate-600">
        {isLogin
          ? "Use Supabase auth or local fallback mode when env vars are not configured."
          : "Register to access Localnet AR subledger workflow screens."}
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);

          try {
            if (isLogin) {
              await signIn(email.trim(), password);
            } else {
              await signUp(email.trim(), password);
            }
            router.replace("/app");
          } catch (nextError) {
            const message = nextError instanceof Error ? nextError.message : "Authentication failed.";
            setError(message);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Input
          label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          autoComplete="email"
          placeholder="finance@company.com"
        />
        <Input
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          required
          minLength={8}
          autoComplete={isLogin ? "current-password" : "new-password"}
          placeholder="At least 8 characters"
        />

        {error ? <p className="text-[11px] font-medium text-rose-600">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Please wait..." : isLogin ? "Sign in" : "Register"}
        </Button>
      </form>

      <p className="mt-4 text-[11px] text-slate-600">
        {isLogin ? "Need an account?" : "Already have an account?"}{" "}
        <Link
          href={isLogin ? "/register" : "/login"}
          className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2"
        >
          {isLogin ? "Register" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
