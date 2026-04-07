import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-3 py-3 md:px-4 md:py-4">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1620px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm backdrop-blur">
        <Sidebar />
        <div className="flex min-h-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 md:py-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
