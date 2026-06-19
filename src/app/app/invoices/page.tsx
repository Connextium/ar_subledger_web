import { redirect } from "next/navigation";

export default function LegacyInvoicesPage() {
  redirect("/app/vendor-supplier/invoices");
}
