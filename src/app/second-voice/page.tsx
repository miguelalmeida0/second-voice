import type { Metadata } from "next";
import { GhostwriterPage } from "@/components/ghostwriter/GhostwriterPage";
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

export default function SecondVoiceRoute() {
  return <GhostwriterPage features={getGhostwriterFeatureAvailability()} />;
}
