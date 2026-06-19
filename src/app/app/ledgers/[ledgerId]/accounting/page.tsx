import { redirect } from "next/navigation";

type AccountingRedirectPageProps = {
  params: { ledgerId: string };
};

export default function AccountingRedirectPage({ params }: AccountingRedirectPageProps) {
  redirect(`/app/vendor-supplier/ledgers/${params.ledgerId}/accounting`);
}