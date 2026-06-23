import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

function assertExcludes(source: string, unexpected: string, label: string) {
  if (source.includes(unexpected)) {
    throw new Error(`${label}: did not expect ${JSON.stringify(unexpected)}`);
  }
}

const receivePage = readFileSync(resolve("src/app/app/anchor-buyer/vendor-invoices/page.tsx"), "utf8");
const detailPage = readFileSync(resolve("src/app/app/anchor-buyer/vendor-invoices/[pubkey]/page.tsx"), "utf8");
const paymentsPage = readFileSync(resolve("src/app/app/anchor-buyer/payments/page.tsx"), "utf8");

for (const [label, source] of [
  ["receive page", receivePage],
  ["detail page", detailPage],
  ["payments page", paymentsPage],
] as const) {
  assertIncludes(source, "parseAmountToMinor", `${label} converts major currency input to minor units`);
  assertIncludes(source, "formatLamportsAmount", `${label} formats stored minor units for display`);
  assertExcludes(source, "Amount Minor", `${label} should not expose minor-unit label`);
  assertExcludes(source, "amountMinor: Number(amount)", `${label} should not send major amount directly`);
}
