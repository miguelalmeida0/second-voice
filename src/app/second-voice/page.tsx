import type { Metadata } from "next";
import { headers } from "next/headers";
import { GhostwriterPage } from "@/components/ghostwriter/GhostwriterPage";
import { BetaSignIn } from "@/components/ghostwriter/BetaSignIn";
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

  return <><BetaSignIn emailEnabled={process.env.GHOSTWRITER_EMAIL_LOGIN_ENABLED==="true"} githubEnabled={process.env.GHOSTWRITER_GITHUB_LOGIN_ENABLED==="true"} portfolio={process.env.GHOSTWRITER_RELEASE_PROFILE==="portfolio-free"}/><GhostwriterPage features={getGhostwriterFeatureAvailability()} /></>;
}
