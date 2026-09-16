import test from "node:test";
import assert from "node:assert/strict";
import { seedCombinedHistory } from "./fixtures/combined-history-seed.mjs";

for (const fail of [false, true]) {
  test(`historical fixture restores the guard after ${fail ? "failed" : "successful"} seeding`, () => {
    const seen: string[] = [];
    const sql = (statement: string) => {
      seen.push(statement);
      if (statement.startsWith("select exists")) return "t";
      if (fail && statement === "fixture insert") throw new Error("fixture write failed");
      return "";
    };
    if (fail) assert.throws(() => seedCombinedHistory(sql, "fixture insert"), /fixture write failed/);
    else seedCombinedHistory(sql, "fixture insert");
    assert.match(seen[1], /disable trigger ghostwriter_00_combined_ai_cap/);
    assert.match(seen.at(-1)!, /enable trigger ghostwriter_00_combined_ai_cap/);
    assert.equal(seen.filter(s => s === "fixture insert").length, 1);
  });
}

test("historical fixture remains compatible with a baseline database without the new trigger", () => {
  const seen: string[] = [];
  seedCombinedHistory((statement: string) => {seen.push(statement); return "f";}, "fixture insert");
  assert.deepEqual(seen.slice(1), ["fixture insert"]);
});
