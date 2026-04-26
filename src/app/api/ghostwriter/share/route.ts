import { z } from "zod";
import { PUBLIC_REWRITE_SHARE_CONSENT } from "@/lib/ghostwriter-share";
import { buildNoStoreHeaders, mergeHeaders } from "@/lib/security-http";
import { validateGhostwriterHeaders, validateGhostwriterPost } from "@/server/abuse-protection";
import {
  InputSchema,
  REWRITE_OUTPUT_MAX_CHARS,
  RewriteArtifactProvenanceSchema,
  createPublicRewriteArtifact,
} from "@/server/ghostwriter";
import { readGhostwriterJsonBody } from "@/server/ghostwriter-request";
import { createRequestId, withRequestId } from "@/server/request-id";

export const runtime = "nodejs";

const ShareRequestSchema = InputSchema.extend({
  artifactProvenance: RewriteArtifactProvenanceSchema.optional(),
  challengeNonce: z.string().min(1).max(10),
  challengeToken: z.string().min(16).max(1024),
  rewrite: z.string().trim().min(1).max(REWRITE_OUTPUT_MAX_CHARS),
  shareConsent: z.literal(PUBLIC_REWRITE_SHARE_CONSENT),
});

export async function POST(request: Request) {
  const requestId = createRequestId();
  const noStoreHeaders = (headers?: HeadersInit) =>
    withRequestId(headers ? mergeHeaders(headers, buildNoStoreHeaders()) : buildNoStoreHeaders(), requestId);
  const headerGuard = await validateGhostwriterHeaders(request);

  if ("status" in headerGuard) {
    return Response.json(
      { shortId: null, error: headerGuard.error },
      {
        headers: noStoreHeaders(headerGuard.headers),
        status: headerGuard.status,
      },
    );
  }

  const body = await readGhostwriterJsonBody(request);

  if (!body.ok) {
    return Response.json(
      { shortId: null, error: body.error },
      {
        headers: noStoreHeaders(),
        status: body.status,
      },
    );
  }

  const parsed = ShareRequestSchema.safeParse(body.data);

  if (!parsed.success) {
    return Response.json(
      { shortId: null, error: "Invalid request." },
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
  );

  if ("status" in guard) {
    return Response.json(
      { shortId: null, error: guard.error },
      {
        headers: noStoreHeaders(guard.headers),
        status: guard.status,
      },
    );
  }

  const result = await createPublicRewriteArtifact(
    {
      author: parsed.data.author,
      artifactProvenance: parsed.data.artifactProvenance,
      mood: parsed.data.mood,
      rewrite: parsed.data.rewrite,
      text: parsed.data.text,
    },
    { requestId },
  );

  return Response.json(
    {
      shortId: result.shortId,
      error: result.error,
    },
    {
      headers: noStoreHeaders(),
      status: result.status,
    },
  );
}
