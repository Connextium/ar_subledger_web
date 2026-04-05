import { AuthForm } from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export default function RegisterPage() {
  return (
    <AuthPageShell>
      <AuthForm mode="register" />
    </AuthPageShell>
  );
}
