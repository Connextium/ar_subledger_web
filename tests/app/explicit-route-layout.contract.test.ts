import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const removedPages = [
  "src/app/app/customers/page.tsx",
  "src/app/app/invoices/page.tsx",
  "src/app/app/ledgers/page.tsx",
  "src/app/app/ledgers/[ledgerId]/accounting/page.tsx",
  "src/app/app/timeline/page.tsx",
  "src/app/app/workflow/page.tsx",
  "src/app/app/vendor-supplier/page.tsx",
  "src/app/app/anchor-buyer/page.tsx",
  "src/app/app/facilitator/page.tsx",
];

for (const page of removedPages) {
  assert.equal(existsSync(resolve(page)), false, `${page} must be removed`);
}

const sidebar = readFileSync(resolve("src/components/layout/sidebar.tsx"), "utf8");
assert.ok(sidebar.includes('{ href: "/app/anchor-buyer/workflow", label: "Buyer Home" }'));
assert.ok(!sidebar.includes('{ href: "/app/anchor-buyer", label: "Buyer Home" }'));
assert.ok(!sidebar.includes("/^\\/app\\/ledgers\\/"));

const sidebarHrefs = Array.from(sidebar.matchAll(/href: "([^"]+)"/g), (match) => match[1]);
const duplicateSidebarHrefs = sidebarHrefs.filter((href, index) => sidebarHrefs.indexOf(href) !== index);
assert.deepEqual(duplicateSidebarHrefs, [], "sidebar nav hrefs must be unique because href is used as the React key");

const invoices = readFileSync(resolve("src/app/app/vendor-supplier/invoices/page.tsx"), "utf8");
assert.ok(invoices.includes("`/app/vendor-supplier/customers/${customer.pubkey}`"));
assert.ok(!invoices.includes("`/app/customers/${customer.pubkey}`"));
assert.ok(invoices.includes("`/app/vendor-supplier/settlements?invoice=${row.pubkey}`"));
assert.ok(!invoices.includes("`/app/settlements?invoice=${row.pubkey}`"));

const settlementsRedirect = readFileSync(resolve("src/app/app/settlements/page.tsx"), "utf8");
assert.ok(settlementsRedirect.includes('redirect("/app/vendor-supplier/settlements")'));

const customerDetail = readFileSync(
  resolve("src/app/app/vendor-supplier/customers/[pubkey]/page.tsx"),
  "utf8",
);
assert.ok(!customerDetail.includes("/app/customers"));
assert.ok(!customerDetail.includes("Legacy Customer Route"));
