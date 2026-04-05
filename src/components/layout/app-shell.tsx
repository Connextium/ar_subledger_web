import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7f4ed,transparent_38%),radial-gradient(circle_at_bottom_right,#e6f0f9,transparent_35%)]">
      <div className="mx-auto flex min-h-screen max-w-[1540px] border-x border-slate-200 bg-slate-50/80">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
