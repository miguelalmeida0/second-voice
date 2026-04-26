import { CaseStudyClosingNotes } from "@/components/ghostwriter/case-study/ClosingNotes";
import { CaseStudyEngineeringChoices } from "@/components/ghostwriter/case-study/EngineeringChoices";
import { CaseStudyFooter } from "@/components/ghostwriter/case-study/Footer";
import { CaseStudyHero } from "@/components/ghostwriter/case-study/Hero";
import { CaseStudyHowItWorks } from "@/components/ghostwriter/case-study/HowItWorks";
import { CaseStudyLiveExample } from "@/components/ghostwriter/case-study/LiveExample";
import { CaseStudyMetaStrip } from "@/components/ghostwriter/case-study/MetaStrip";
import { CaseStudyPullQuote } from "@/components/ghostwriter/case-study/PullQuote";
import { CaseStudyTopBar } from "@/components/ghostwriter/case-study/TopBar";
import { CaseStudyWhatChanged } from "@/components/ghostwriter/case-study/WhatChanged";
import { CaseStudyWhyThisStack } from "@/components/ghostwriter/case-study/WhyThisStack";

export function GhostwriterCaseStudyPage() {
  return (
    <main
      id="case-study-top"
      className="gw-case-study cs-grain relative min-h-screen overflow-x-clip bg-[hsl(var(--cs-background))] text-[hsl(var(--cs-foreground))]"
    >
      <div className="relative z-10">
        <CaseStudyTopBar />

        <article className="mx-auto max-w-[1520px] px-6 md:px-10 xl:px-14">
          <section className="grid grid-cols-1 gap-14 pb-18 pt-10 md:pb-24 lg:grid-cols-12 lg:gap-16 lg:pt-16">
            <div className="lg:col-span-7">
              <CaseStudyHero />
            </div>
            <div className="lg:col-span-5 lg:pt-10">
              <CaseStudyLiveExample />
            </div>
          </section>

          <CaseStudyMetaStrip />

          <CaseStudyEngineeringChoices />

          <CaseStudyPullQuote />

          <CaseStudyHowItWorks />

          <CaseStudyWhatChanged />

          <CaseStudyWhyThisStack />

          <CaseStudyClosingNotes />
        </article>

        <CaseStudyFooter />
      </div>
    </main>
  );
}
