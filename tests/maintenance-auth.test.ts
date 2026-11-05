import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the real route; replace only its external datastore and log sink.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/app/api/internal/portfolio-maintenance/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function route(secret: string | undefined) {
  const exports: { GET?: (request: Request) => Promise<Response> } = {};
  let heartbeats = 0;
  runInNewContext(compiled, {
    exports, Buffer, process: { env: { CRON_SECRET: secret } },
    require: (name: string) => {
      if (name === "@/integrations/supabase/client.server") return {
        getSupabaseAdmin: () => ({ rpc: async (rpc: string) => {
          assert.equal(rpc, "ghostwriter_portfolio_heartbeat");
          heartbeats++;
          return { data: { cronActive: true, releaseActive: true, controlValid: true }, error: null };
        } }),
      };
      if (name === "@/server/security-events") return { logSecurityEvent: () => undefined };
      return require(name);
    },
  });
  return { get: exports.GET!, heartbeats: () => heartbeats };
}

test("maintenance accepts the exact bearer secret including the letter s", async () => {
  for (const secret of ["s".repeat(32), "S".repeat(32), "x".repeat(32)]) {
    const handler = route(secret);
    const response = await handler.get(new Request("https://local/api/internal/portfolio-maintenance", {
      headers: { authorization: `Bearer ${secret}` },
    }));
    assert.equal(response.status, 200);
    assert.equal(handler.heartbeats(), 1);
  }
});

test("malformed maintenance credentials deny access without throwing or running maintenance", async () => {
  for (const authorization of [undefined, `Basic ${"x".repeat(32)}`, `Bearer ${"y".repeat(32)}`, `Bearer ${"é".repeat(32)}`, `Bearer ${"x".repeat(16)} ${"x".repeat(15)}`]) {
    const handler = route("x".repeat(32));
    const response = await handler.get(new Request("https://local/api/internal/portfolio-maintenance", {
      headers: authorization ? { authorization } : {},
    }));
    assert.equal(response.status, 404);
    assert.equal(handler.heartbeats(), 0);
  }
});

test("maintenance remains unavailable without a sufficiently long configured secret", async () => {
  for (const secret of [undefined, "", "short"]) {
    const handler = route(secret);
    const response = await handler.get(new Request("https://local/api/internal/portfolio-maintenance", {
      headers: { authorization: `Bearer ${secret ?? ""}` },
    }));
    assert.equal(response.status, 404);
    assert.equal(handler.heartbeats(), 0);
  }
});
