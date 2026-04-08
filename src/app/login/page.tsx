import { AuthForm } from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export default function LoginPage() {
  return (
    <AuthPageShell>
      <div className="grid min-h-screen grid-cols-1 bg-slate-50 lg:grid-cols-2">
        <section className="relative flex items-center justify-center overflow-hidden border-b border-slate-200 bg-slate-100 px-6 py-10 lg:border-b-0 lg:border-r lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.28),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(203,213,225,0.45),transparent_50%)]" />
          <div className="relative z-10 flex min-h-[560px] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-slate-50/90 p-8 shadow-sm backdrop-blur">
            <div className="mt-20">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">AR Suite</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">C.L.O.B</h1>
              <p className="mt-1 text-sm text-slate-700">Contract, Ledger, Object, Book</p>

              <div className="mt-4 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                <p><span className="font-semibold">C</span>ontract: Smart-contract rules enforce integrity.</p>
                <p><span className="font-semibold">L</span>edger: Workspace-scoped ledger contexts.</p>
                <p><span className="font-semibold">O</span>bject: Customer/invoice records are traceable objects.</p>
                <p><span className="font-semibold">B</span>ook: Book-ready lifecycle from issue to settlement.</p>
              </div>

              <p className="mt-5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                C.L.O.B keeps AR operations trustworthy, contextual, and auditable by combining contract-enforced rules, ledger-scoped control, object-level traceability, and book-ready workflow states.
              </p>
            </div>

            <p className="mt-auto pt-6 text-[11px] tracking-[0.08em] text-slate-500">
              The Connextium@2026
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-md">
            <AuthForm mode="login" />
          </div>
        </section>
      </div>
    </AuthPageShell>
  );
}
