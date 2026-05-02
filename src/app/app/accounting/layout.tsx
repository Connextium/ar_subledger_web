import { ReactNode } from "react";
import { PageLayout } from "../../../components/ui/page-layout";

export default function AccountingLayout({ children }: { children: ReactNode }) {
  return <PageLayout>{children}</PageLayout>;
}
