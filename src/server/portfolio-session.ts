import "../lib/server-only.ts";

import type { PortfolioSession } from "../lib/portfolio-access.ts";
import { parsePortfolioAllowance } from "../lib/portfolio-access.ts";
import { authenticateAiRequest } from "./ai-auth.ts";
import {
  anonymousPortfolioAllowance,
  readAnonymousVisitor,
} from "./anonymous-visitor.ts";
import { freeTrial, readAuthCookie } from "./auth-session.ts";

export async function resolvePortfolioSession(
  request: Request,
): Promise<PortfolioSession> {
  if (process.env.GHOSTWRITER_RELEASE_PROFILE !== "portfolio-free") {
    return { status: "checking" };
  }

  try {
    const authenticated = await authenticateAiRequest(request);

    if (authenticated.ok && authenticated.identity.sessionId) {
      const allowance = parsePortfolioAllowance(
        await freeTrial(
          authenticated.identity.accountId,
          authenticated.identity.sessionId,
          false,
        ),
      );

      return allowance
        ? { status: "authenticated", allowance }
        : { status: "unavailable" };
    }

    /*
     * A refresh cookie means this browser may still have a recoverable GitHub
     * session. Leave that one case to the auth route, which is the only place
     * allowed to rotate auth cookies. Everyone else can be resolved directly
     * from the durable anonymous visitor identity during SSR.
     */
    if (readAuthCookie(request, "refresh")) {
      return { status: "checking" };
    }

    const visitorId = readAnonymousVisitor(request);

    if (!visitorId) {
      return { status: "checking" };
    }

    const allowance = parsePortfolioAllowance(
      await anonymousPortfolioAllowance(visitorId),
    );

    return allowance
      ? { status: "anonymous", allowance }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
