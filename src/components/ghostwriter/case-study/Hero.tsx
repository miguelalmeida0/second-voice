export function CaseStudyHero() {
  return (
    <div className="relative">
      <h1 className="cs-font-serif-display max-w-[15ch] text-[clamp(2.2rem,4.1vw,3.85rem)] leading-[1.08] tracking-[-0.015em] text-[hsl(var(--cs-foreground))] md:max-w-[17ch]">
        I have built the Second Voice To See How Much One Sentence Could Change
      </h1>

      <p className="cs-human-note mt-8 max-w-[34ch] sm:max-w-none">
        An experiment in personal AI writing · author lens · mood-specific rewrites
      </p>

      <p className="mt-6 max-w-[31ch] text-lg leading-relaxed text-[hsl(var(--cs-muted-foreground))] sm:max-w-[43ch]">
        I was working on a simple idea: A sentence can sometimes benefit from a fresh perspective.
        Write a line, try it in a few voices, and take what gets closest to what you meant.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <a
          href="#read"
          className="group inline-flex items-center gap-2 text-sm text-[hsl(var(--cs-foreground)/0.8)] transition-colors hover:text-[hsl(var(--cs-foreground))]"
        >
          <span className="cs-inline-label">Note</span>
          <span className="h-px w-10 bg-[hsl(var(--cs-foreground)/0.3)] transition-all group-hover:w-16 group-hover:bg-[hsl(var(--cs-foreground))]" />
          <span>Read the thinking</span>
        </a>
      </div>
    </div>
  );
}
