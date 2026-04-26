import "../lib/server-only.ts";

import { GHOSTWRITER_MAX_BODY_BYTES } from "@/server/abuse-protection";

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

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    receivedBytes += value.byteLength;

    if (receivedBytes > GHOSTWRITER_MAX_BODY_BYTES) {
      await reader.cancel();
      return {
        error: "Request too large.",
        ok: false,
        status: 413,
      };
    }

    chunks.push(value);
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
