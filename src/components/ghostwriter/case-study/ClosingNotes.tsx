import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function CaseStudyClosingNotes() {
  return (
    <section className="py-20 md:py-28">
      <div className="cs-closing-note">
        <div>
          <h2 className="cs-font-serif-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            What I would do next
          </h2>
          <p className="mt-6 max-w-[66ch] text-[17px] leading-relaxed text-[hsl(var(--cs-foreground)/0.78)]">
            I would rename the author modes into clearer style lenses, add stronger compare
            controls for judging one rewrite against another, and make saved rewrites feel less
            like files and more like scraps: small fragments worth keeping, not a productivity
            archive.
          </p>
        </div>

        <Link
          href="/second-voice"
          className="cs-closing-cta group inline-flex w-fit items-center gap-3"
        >
          <span>Open Second Voice AI</span>
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
