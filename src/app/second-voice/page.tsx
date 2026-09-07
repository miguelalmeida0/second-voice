import type { Metadata } from "next";
import { headers } from "next/headers";
import { GhostwriterPage } from "@/components/ghostwriter/GhostwriterPage";
import { BetaSignIn } from "@/components/ghostwriter/BetaSignIn";
import { PortfolioAccess } from "@/components/ghostwriter/PortfolioAccess";
import { getGhostwriterFeatureAvailability } from "@/server/ghostwriter-feature-flags";

export const metadata: Metadata = {
  title: "Second Voice AI — Rewrite anything with a great author",
  description:
    "Pick a writer, drag a mood dial, and watch your words come back from that author.",
  openGraph: {
    title: "Second Voice AI",
    description: "A portfolio-first AI rewrite theater with literary authors and mood-tuned playback.",
  },
};

export default async function SecondVoiceRoute() {
  await headers();

  const portfolio = process.env.GHOSTWRITER_RELEASE_PROFILE === "portfolio-free";
  const githubEnabled = process.env.GHOSTWRITER_GITHUB_LOGIN_ENABLED === "true";
  return <PortfolioAccess enabled={portfolio} githubEnabled={githubEnabled}>
    <BetaSignIn emailEnabled={process.env.GHOSTWRITER_EMAIL_LOGIN_ENABLED === "true"} githubEnabled={githubEnabled} portfolio={portfolio} />
    <GhostwriterPage features={getGhostwriterFeatureAvailability()} />
  </PortfolioAccess>;
}
