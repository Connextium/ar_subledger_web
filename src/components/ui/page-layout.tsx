import type { ReactNode } from "react";

export function PageLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
