import { AuthForm } from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export default function RegisterPage() {
  return (
    <AuthPageShell>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <AuthForm mode="register" />
      </div>
    </AuthPageShell>
  );
}
