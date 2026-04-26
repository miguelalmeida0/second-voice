import Link from "next/link";
import { SecondVoiceMark } from "@/components/ghostwriter/SecondVoiceMark";

export function CaseStudyFooter() {
  return (
    <footer className="relative mt-20 border-t border-[hsl(var(--cs-hairline))]">
      <div className="mx-auto flex max-w-[1520px] flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center md:px-10 xl:px-14">
        <SecondVoiceMark className="[&_.second-voice-mark-title]:text-[hsl(var(--cs-foreground))] [&_.second-voice-mark-divider]:bg-[hsl(var(--cs-hairline))] [&_.second-voice-mark-tagline]:text-[hsl(var(--cs-muted-foreground))]" />

        <div className="flex items-center gap-6 text-sm text-[hsl(var(--cs-muted-foreground))]">
          <Link href="/second-voice" className="transition-colors hover:text-[hsl(var(--cs-foreground))]">
            Open Second Voice AI
          </Link>
          <a href="#read" className="transition-colors hover:text-[hsl(var(--cs-foreground))]">
            Read note
          </a>
          <a href="#case-study-top" className="transition-colors hover:text-[hsl(var(--cs-foreground))]">
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
