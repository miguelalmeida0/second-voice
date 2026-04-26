import { buildNoStoreHeaders, mergeHeaders } from "@/lib/security-http";
import { issueChallengeToken } from "@/server/abuse-protection";
import { createRequestId, withRequestId } from "@/server/request-id";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const challenge = await issueChallengeToken(request);

  if ("status" in challenge) {
    return Response.json(
      {
        challengeToken: "",
        difficulty: null,
        error: challenge.error,
      },
      {
        headers: withRequestId(mergeHeaders(challenge.headers, buildNoStoreHeaders()), requestId),
        status: challenge.status,
      },
    );
  }

  return Response.json(
    {
      challengeToken: challenge.challengeToken,
      difficulty: challenge.difficulty,
      error: null,
    },
    {
      headers: withRequestId(buildNoStoreHeaders(), requestId),
      status: 200,
    },
  );
}
