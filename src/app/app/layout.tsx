import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { ContextBar } from "@/components/layout/context-bar";
import { WorkingContextProvider } from "@/context/working-context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <WorkingContextProvider>
        <AppShell>
          <ContextBar />
          {children}
        </AppShell>
      </WorkingContextProvider>
    </AuthGuard>
  );
}
