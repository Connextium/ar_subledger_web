import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function collectSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return collectSourceFiles(fullPath);
    return fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

const files = collectSourceFiles("src/lib/api-client/v1");

const forbidden = [
  "@/services/",
  "@/server/api/",
  "@/lib/supabase/",
  "@/lib/solana/",
  "createServiceProxy",
];

const violations = files.flatMap((file) => {
  const source = readFileSync(resolve(file), "utf8");
  return forbidden.filter((token) => source.includes(token)).map((token) => `${file} contains ${token}`);
});

assert.deepEqual(violations, []);
