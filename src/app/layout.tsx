import type { Metadata } from "next";
import { AppProviders } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AR Subledger dApp",
  description: "Localnet SaaS-style dApp for AR Subledger workflows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full text-slate-900">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
