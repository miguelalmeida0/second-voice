import "../lib/server-only.ts";

import { GHOSTWRITER_MAX_BODY_BYTES } from "./abuse-protection.ts";

export type GhostwriterJsonBody =
  | { data: unknown; ok: true }
  | {
      error: string;
      ok: false;
      status: number;
    };

export async function readGhostwriterJsonBody(request: Request): Promise<GhostwriterJsonBody> {
  const reader = request.body?.getReader();

  if (!reader) {
    return {
      error: "Invalid request body.",
      ok: false,
      status: 400,
    };
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("body_deadline")), 10_000);
  });
  try {
  while (true) {
    const { done, value } = await Promise.race([reader.read(), deadline]);

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    receivedBytes += value.byteLength;

    if (receivedBytes > GHOSTWRITER_MAX_BODY_BYTES) {
      void reader.cancel().catch(() => undefined);
      return {
        error: "Request too large.",
        ok: false,
        status: 413,
      };
    }

    chunks.push(value);
  }

  } catch {
    void reader.cancel().catch(() => undefined);
    return {ok:false,error:"Request body deadline exceeded.",status:408};
  } finally {
    clearTimeout(timer);
  }

  try {
    const json = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8"));
    return { data: json, ok: true };
  } catch {
    return {
      error: "Invalid request body.",
      ok: false,
      status: 400,
    };
  }
}
