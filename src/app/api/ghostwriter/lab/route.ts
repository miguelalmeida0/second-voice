import { z } from "zod";
import type { RewriteLabResponse } from "@/lib/ghostwriter-lab-shared";
import { buildNoStoreHeaders, mergeHeaders } from "@/lib/security-http";
import {
  GHOSTWRITER_MAX_BODY_BYTES,
  validateGhostwriterHeaders,
  validateGhostwriterLabPost,
} from "@/server/abuse-protection";
import { RewriteLabInputSchema, runRewriteLab } from "@/server/ghostwriter-lab";
import { createRequestId, withRequestId } from "@/server/request-id";

export const runtime = "nodejs";

const RequestSchema = RewriteLabInputSchema.extend({
  challengeNonce: z.string().min(1).max(10),
  challengeToken: z.string().min(16).max(1024),
});

function labResponse(error: string, status: number, requestId: string, headers?: HeadersInit) {
  return Response.json(
    {
      error,
      lab: null,
    } satisfies RewriteLabResponse,
    {
      headers: withRequestId(
        headers ? mergeHeaders(headers, buildNoStoreHeaders()) : buildNoStoreHeaders(),
        requestId,
      ),
      status,
    },
  );
}

async function readJsonBody(request: Request): Promise<
  | { data: unknown; ok: true }
  | {
      error: string;
      ok: false;
      status: number;
    }
> {
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

export async function POST(request: Request) {
  const requestId = createRequestId();
  const headerGuard = await validateGhostwriterHeaders(request);

  if ("status" in headerGuard) {
    return labResponse(headerGuard.error, headerGuard.status, requestId, headerGuard.headers);
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return labResponse(body.error, body.status, requestId);
  }

  const parsed = RequestSchema.safeParse(body.data);

  if (!parsed.success) {
    return labResponse("Invalid request.", 400, requestId);
  }

  const guard = await validateGhostwriterLabPost(
    request,
    parsed.data.challengeToken,
    parsed.data.challengeNonce,
  );

  if ("status" in guard) {
    return labResponse(guard.error, guard.status, requestId, guard.headers);
  }

  const result = await runRewriteLab(
    {
      author: parsed.data.author,
      baselineRewrite: parsed.data.baselineRewrite,
      mood: parsed.data.mood,
      source: parsed.data.source,
    },
    { requestId },
  );

  return Response.json(
    {
      error: result.error,
      lab: result.lab,
    } satisfies RewriteLabResponse,
    {
      headers: withRequestId(buildNoStoreHeaders(), requestId),
      status: result.status,
    },
  );
}
