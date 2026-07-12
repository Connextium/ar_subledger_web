import { AuthForm } from "@/components/auth/auth-form";
import { LoginAvailabilityWarning } from "@/components/auth/login-availability-warning";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { headers } from "next/headers";

function splitAllowedDevOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeHost(value: string): string {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function hostMatchesAllowedOrigin(host: string, allowedOrigin: string): boolean {
  const normalizedHost = normalizeHost(host);
  const normalizedAllowed = normalizeHost(allowedOrigin);
  const hostName = normalizedHost.split(":")[0] ?? normalizedHost;
  const allowedName = normalizedAllowed.split(":")[0] ?? normalizedAllowed;

  if (normalizedHost === normalizedAllowed || hostName === allowedName) {
    return true;
  }

  if (allowedName.startsWith("*.")) {
    const suffix = allowedName.slice(1);
    return hostName.endsWith(suffix);
  }

  return false;
}

function isLoopbackHost(host: string): boolean {
  const hostName = normalizeHost(host).split(":")[0] ?? "";
  return hostName === "localhost" || hostName === "127.0.0.1" || hostName === "0.0.0.0" || hostName.endsWith(".localhost");
}

function shouldShowDevOriginWarning(host: string): boolean {
  if (process.env.NODE_ENV !== "development" || !host || isLoopbackHost(host)) {
    return false;
  }

  const allowedOrigins = [
    ...splitAllowedDevOrigins(process.env.WEB_ALLOWED_DEV_ORIGINS),
    ...splitAllowedDevOrigins(process.env.NEXT_ALLOWED_DEV_ORIGINS),
    ...splitAllowedDevOrigins(process.env.ALLOWED_DEV_ORIGINS),
  ];

  return !allowedOrigins.some((origin) => hostMatchesAllowedOrigin(host, origin));
}

export default async function LoginPage() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const currentHost = forwardedHost ?? requestHeaders.get("host") ?? "";
  const showDevOriginWarning = shouldShowDevOriginWarning(currentHost);

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-50 lg:grid-cols-2">
      <section className="relative flex items-center justify-center overflow-hidden border-b border-slate-200 bg-slate-100 px-6 py-10 lg:border-b-0 lg:border-r lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.28),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(203,213,225,0.45),transparent_50%)]" />
        <div className="relative z-10 flex min-h-[560px] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-slate-50/90 p-8 shadow-sm backdrop-blur">
          <div className="mt-20">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">AR Suite</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">C.L.ō.B</h1>
            <p className="mt-1 text-sm text-slate-700">Contract, Ledger, Ōbject, Book</p>

            <div className="mt-4 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
              <p><span className="font-semibold">C</span>ontract: Smart-contract rules enforce integrity.</p>
              <p><span className="font-semibold">L</span>edger: Workspace-scoped ledger contexts.</p>
              <p><span className="font-semibold">Ō</span>bject: Customer/invoice records are traceable objects.</p>
              <p><span className="font-semibold">B</span>ook: Book-ready lifecycle from issue to settlement.</p>
            </div>

            <p className="mt-5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              C.L.O.B keeps AR operations trustworthy, contextual, and auditable by combining contract-enforced rules, ledger-scoped control, object-level traceability, and book-ready workflow states.
            </p>
          </div>

          <p className="mt-auto pt-6 text-[11px] tracking-[0.08em] text-slate-500">
            Joined by Finux Labs & The Connextium@2026
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10 lg:px-10">
        <div className="w-full max-w-md space-y-3">
          {showDevOriginWarning ? (
            <Alert variant="destructive">
              <AlertDescription>
                Cross-origin access to Next.js dev resources is blocked by default for safety. Add{" "}
                <span className="font-mono">{currentHost}</span> to{" "}
                <span className="font-mono">WEB_ALLOWED_DEV_ORIGINS</span> or{" "}
                <span className="font-mono">NEXT_ALLOWED_DEV_ORIGINS</span>, then restart the web dev server.
              </AlertDescription>
            </Alert>
          ) : null}
          <LoginAvailabilityWarning />
          <AuthForm mode="login" />
        </div>
      </section>
    </div>
  );
}
