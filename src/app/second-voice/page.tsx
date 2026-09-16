import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PortfolioAccess } from "@/components/ghostwriter/PortfolioAccess";
import { SecondVoiceExperience } from "@/components/ghostwriter/SecondVoiceExperience";
import { localAuthPageRedirect } from "@/server/auth-origin";
import { getGhostwriterFeatureAvailability } from "@/server/ghostwriter-feature-flags";
import { resolvePortfolioSession } from "@/server/portfolio-session";

export const metadata: Metadata = {
  title: "Second Voice AI — Rewrite anything with a great author",

  description:
    "Pick a writer, drag the mood dial, and watch your words come back from that author.",

  openGraph: {
    title: "Second Voice AI",

    description:
      "A portfolio-first AI rewrite theater with literary authors and mood-tuned playback.",
  },
};

export default async function SecondVoiceRoute() {
  const requestHeaders = await headers();

  /*
   * Canonicalize before rendering sign-in so the
   * host-only PKCE cookie and registered callback
   * use the same host.
   *
   * Keep this outside Proxy. The auth repair depends
   * on this behavior.
   */
  const canonical = localAuthPageRedirect(
    new Request("http://localhost/second-voice", {
      headers: requestHeaders,
    }),
  );

  if (canonical) {
    redirect(canonical);
  }

  const portfolio =
    process.env.GHOSTWRITER_RELEASE_PROFILE === "portfolio-free";

  const githubEnabled = process.env.GHOSTWRITER_GITHUB_LOGIN_ENABLED === "true";

  const emailEnabled = process.env.GHOSTWRITER_EMAIL_LOGIN_ENABLED === "true";

  const initialSession = portfolio
    ? await resolvePortfolioSession(
        new Request("http://localhost/second-voice", {
          headers: requestHeaders,
        }),
      )
    : { status: "checking" as const };

  return (
    <PortfolioAccess
      enabled={portfolio}
      githubEnabled={githubEnabled}
      initialSession={initialSession}
    >
      <SecondVoiceExperience
        emailEnabled={emailEnabled}
        features={getGhostwriterFeatureAvailability()}
        githubEnabled={githubEnabled}
        portfolio={portfolio}
      />
    </PortfolioAccess>
  );
}
