// Test-process-only fault injection; never imported by application code.
// node --import ./tests/performance/slow-store.mjs node_modules/next/dist/bin/next start
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url === "http://127.0.0.1:54329/rest/v1/rpc/ghostwriter_anonymous_allowance") {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return Response.json({ remaining: 3, todayRemaining: 3, available: true });
  }
  return originalFetch(input, init);
};
