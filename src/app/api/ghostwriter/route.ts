import { z } from "zod";
import { buildNoStoreHeaders, mergeHeaders } from "@/lib/security-http";
import {
  validateGhostwriterHeaders,
  validateGhostwriterPost,
} from "@/server/abuse-protection";
import { executeGovernedRewrite } from "@/server/ai-gateway";
import { InputSchema } from "@/server/ghostwriter";
import { readGhostwriterJsonBody } from "@/server/ghostwriter-request";
import { PUBLIC_REWRITE_SHARE_CONSENT } from "@/lib/ghostwriter-share";
import { createRequestId, withRequestId } from "@/server/request-id";

export const runtime = "nodejs";

const RequestSchema = InputSchema.extend({
  challengeNonce: z.string().min(1).max(10),
  challengeToken: z.string().min(16).max(1024),
  share: z.boolean().optional().default(false),
  shareConsent: z.literal(PUBLIC_REWRITE_SHARE_CONSENT).optional(),
}).strict();

export async function POST(request: Request) {
  const requestId = createRequestId();
  const noStoreHeaders = (headers?: HeadersInit) =>
    withRequestId(headers ? mergeHeaders(headers, buildNoStoreHeaders()) : buildNoStoreHeaders(), requestId);
  const headerGuard = await validateGhostwriterHeaders(request);

  if ("status" in headerGuard) {
    return Response.json(
      { rewrite: "", shortId: null, moodLabel: null, operationId: null, error: headerGuard.error },
      {
        headers: noStoreHeaders(headerGuard.headers),
        status: headerGuard.status,
      },
    );
  }

  const body = await readGhostwriterJsonBody(request);

  if (!body.ok) {
    return Response.json(
      { rewrite: "", shortId: null, moodLabel: null, operationId: null, error: body.error },
      {
        headers: noStoreHeaders(),
        status: body.status,
      },
    );
  }

  const parsed = RequestSchema.safeParse(body.data);

  if (!parsed.success) {
    return Response.json(
      { rewrite: "", shortId: null, moodLabel: null, operationId: null, error: "Invalid request." },
      {
        headers: noStoreHeaders(),
        status: 400,
      },
    );
  }

  const guard = await validateGhostwriterPost(
    request,
    parsed.data.challengeToken,
    parsed.data.challengeNonce,
    headerGuard,
  );

  if ("status" in guard) {
    return Response.json(
      { rewrite: "", shortId: null, moodLabel: null, operationId: null, error: guard.error },
      {
        headers: noStoreHeaders(guard.headers),
        status: guard.status,
      },
    );
  }

  const result = await executeGovernedRewrite(
    request,
    {
      author: parsed.data.author,
      mood: parsed.data.mood,
      mode: parsed.data.mode,
      outcome: parsed.data.outcome,
      sharePublicly: parsed.data.share && parsed.data.shareConsent === PUBLIC_REWRITE_SHARE_CONSENT,
      text: parsed.data.text,
    },
    { requestId },
  );
  const status = result.error ? result.status : 200;

  return Response.json(
    {
      artifactToken: result.artifactToken,
      rewrite: result.rewrite,
      shortId: result.shortId,
      moodLabel: result.moodLabel,
      operationId: result.operationId,
      error: result.error,
    },
    {
      headers: noStoreHeaders(),
      status,
    },
  );
}
