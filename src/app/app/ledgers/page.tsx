import { redirect } from "next/navigation";

export default function LegacyLedgersPage() {
  redirect("/app/vendor-supplier/ledgers");
}
