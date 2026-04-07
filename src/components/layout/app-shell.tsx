"use client";

import { type SVGProps, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const sidebarWidth = isSidebarHidden ? 0 : 240;

  return (
    <div className="min-h-screen px-3 py-3 md:px-4 md:py-4">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1620px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm backdrop-blur">
        <div
          className="h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-out"
          style={{ width: sidebarWidth }}
        >
          <Sidebar />
        </div>

        <div className="relative flex h-full w-4 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-100">
          <button
            type="button"
            aria-label={isSidebarHidden ? "Show left pane" : "Hide left pane"}
            title={isSidebarHidden ? "Show left pane" : "Hide left pane"}
            onClick={() => setIsSidebarHidden((current) => !current)}
            className="inline-flex h-8 w-3 items-center justify-center rounded border border-slate-300 bg-slate-100 text-slate-700 transition hover:bg-slate-200"
          >
            {isSidebarHidden ? <ChevronRightIcon className="h-3 w-3" /> : <ChevronLeftIcon className="h-3 w-3" />}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 md:py-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
