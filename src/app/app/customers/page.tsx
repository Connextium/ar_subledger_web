import { redirect } from "next/navigation";

export default function LegacyCustomersPage() {
  redirect("/app/vendor-supplier/customers");
}
