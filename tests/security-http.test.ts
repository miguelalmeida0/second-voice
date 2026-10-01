import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBaselineSecurityHeaders,
  buildContentSecurityPolicy,
  buildNoStoreHeaders,
  mergeHeaders,
} from "../src/lib/security-http.ts";

test("builds a strict nonce-based csp", () => {
  const csp = buildContentSecurityPolicy({
    isDevelopment: false,
    nonce: "nonce-value",
  });

  assert.match(csp, /script-src 'self' 'nonce-nonce-value' 'strict-dynamic';/);
  assert.match(csp, /style-src 'self' 'nonce-nonce-value';/);
  assert.match(csp, /font-src 'self' data:;/);
  assert.match(csp, /object-src 'none';/);
  assert.match(csp, /frame-ancestors 'none';/);
  assert.match(csp, /upgrade-insecure-requests;/);
  assert.doesNotMatch(csp, /unsafe-inline|fonts\.googleapis|fonts\.gstatic/);
});

test("does not upgrade localhost development assets to https", () => {
  const csp = buildContentSecurityPolicy({
    isDevelopment: true,
    nonce: "nonce-value",
  });

  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
});

test("includes baseline browser hardening headers", () => {
  const headers = buildBaselineSecurityHeaders({ isDevelopment: false });
  const keys = new Set(headers.map((header) => header.key));

  assert.equal(keys.has("X-Content-Type-Options"), true);
  assert.equal(keys.has("Permissions-Policy"), true);
  assert.equal(keys.has("Strict-Transport-Security"), true);
});

test("returns no-store headers for sensitive responses", () => {
  const headers = buildNoStoreHeaders();

  assert.equal(headers.get("Cache-Control"), "no-store, max-age=0, must-revalidate");
  assert.equal(headers.get("Pragma"), "no-cache");
});

test("merges later headers over earlier values", () => {
  const headers = mergeHeaders(
    { "Cache-Control": "public, max-age=60" },
    { "Cache-Control": "no-store" },
  );

  assert.equal(headers.get("Cache-Control"), "no-store");
});
