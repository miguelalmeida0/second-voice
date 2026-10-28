import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

test("all app surfaces use custom dropdowns instead of native browser pickers", () => {
  const root = new URL("../src/", import.meta.url);
  const violations = readdirSync(root, { recursive: true })
    .filter((path): path is string => typeof path === "string" && /\.[cm]?[jt]sx?$/.test(path))
    .filter(path => /<(?:select|datalist)\b|createElement\(\s*["'](?:select|datalist)["']/i.test(readFileSync(new URL(path, root), "utf8")));
  assert.deepEqual(violations, [], "Use StudioSelect for every dropdown, including secondary flows and mobile.");
});
