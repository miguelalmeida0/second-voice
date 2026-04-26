import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function CaseStudyTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[hsl(var(--cs-hairline))] bg-[hsl(var(--cs-background)/0.94)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1520px] items-center justify-between px-6 py-4 md:px-10 xl:px-14">
        <Link
          href="/second-voice"
          className="cs-topbar-link group inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Second Voice AI</span>
        </Link>

        <div className="hidden items-center md:flex">
          <span className="cs-eyebrow">Second Voice AI</span>
        </div>
      </div>
    </header>
  );
}
