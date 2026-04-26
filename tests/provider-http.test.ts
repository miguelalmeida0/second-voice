import test from "node:test";
import assert from "node:assert/strict";
import { readLimitedJsonResponse } from "../src/server/ai-provider-http.ts";

test("provider json reader accepts bounded json responses", async () => {
  const parsed = await readLimitedJsonResponse(
    new Response(JSON.stringify({ ok: true })),
    1024,
  );

  assert.deepEqual(parsed, { ok: true });
});

test("provider json reader rejects oversized responses", async () => {
  await assert.rejects(
    () => readLimitedJsonResponse(new Response(JSON.stringify({ text: "x".repeat(128) })), 32),
    /byte limit/i,
  );
});

test("provider json reader aborts while waiting for the response body", async () => {
  const abortController = new AbortController();
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{\"ok\":"));
      },
    }),
  );

  const read = readLimitedJsonResponse(response, 1024, {
    signal: abortController.signal,
  });

  abortController.abort();

  await assert.rejects(read, /body read aborted/i);
});
