import { z } from "zod";
import { buildNoStoreHeaders, mergeHeaders } from "@/lib/security-http";
import { validateGhostwriterFeedbackPost, validateGhostwriterHeaders } from "@/server/abuse-protection";
import { recordRewriteFeedback, RewriteFeedbackSchema } from "@/server/ghostwriter-feedback";
import { readGhostwriterJsonBody } from "@/server/ghostwriter-request";
import { createRequestId, withRequestId } from "@/server/request-id";

export const runtime = "nodejs";

const FeedbackChallengeSchema = z.object({
  challengeNonce: z.string().min(1).max(10),
  challengeToken: z.string().min(16).max(1024),
});

export async function POST(request: Request) {
  const requestId = createRequestId();
  const noStoreHeaders = (headers?: HeadersInit) =>
    withRequestId(headers ? mergeHeaders(headers, buildNoStoreHeaders()) : buildNoStoreHeaders(), requestId);
  const headerGuard = await validateGhostwriterHeaders(request);

  if ("status" in headerGuard) {
    return Response.json(
      { error: headerGuard.error },
      {
        headers: noStoreHeaders(headerGuard.headers),
        status: headerGuard.status,
      },
    );
  }

  const body = await readGhostwriterJsonBody(request);

  if (!body.ok) {
    return Response.json(
      { error: body.error },
      {
        headers: noStoreHeaders(),
        status: body.status,
      },
    );
  }

  const parsedFeedback = RewriteFeedbackSchema.safeParse(body.data);
  const parsedChallenge = FeedbackChallengeSchema.safeParse(body.data);

  if (!parsedFeedback.success || !parsedChallenge.success) {
    return Response.json(
      { error: "Invalid feedback." },
      {
        headers: noStoreHeaders(),
        status: 400,
      },
    );
  }

  const guard = await validateGhostwriterFeedbackPost(
    request,
    parsedChallenge.data.challengeToken,
    parsedChallenge.data.challengeNonce,
  );

  if ("status" in guard) {
    return Response.json(
      { error: guard.error },
      {
        headers: noStoreHeaders(guard.headers),
        status: guard.status,
      },
    );
  }

  const result = await recordRewriteFeedback(
    {
      author: parsedFeedback.data.author,
      artifactProvenance: parsedFeedback.data.artifactProvenance,
      mood: parsedFeedback.data.mood,
      rating: parsedFeedback.data.rating,
      reason: parsedFeedback.data.reason,
      rewrite: parsedFeedback.data.rewrite,
      shortId: parsedFeedback.data.shortId,
    },
    { requestId },
  );

  return Response.json(
    { error: result.error },
    {
      headers: noStoreHeaders(),
      status: result.status,
    },
  );
}
