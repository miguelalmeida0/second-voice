import type { Metadata } from "next";
import { GhostwriterCaseStudyPage } from "@/components/ghostwriter/case-study/CaseStudyPage";

export const metadata: Metadata = {
  title: "Second Voice AI Case Study",
  description:
    "A short case study about building Second Voice AI as a playful, comforting language toy.",
  openGraph: {
    title: "Second Voice AI Case Study",
    description:
      "A short case study about building Second Voice AI as a playful, comforting language toy.",
  },
};

export default function Page() {
  return <GhostwriterCaseStudyPage />;
}
