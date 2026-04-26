export function CaseStudyPullQuote() {
  return (
    <section className="py-20 md:py-28">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-4">
          <h2 className="cs-font-serif-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            Why this exists
          </h2>
        </div>

        <div className="max-w-[67ch] space-y-5 border-t border-[hsl(var(--cs-hairline))] pt-6 text-[18px] leading-relaxed text-[hsl(var(--cs-foreground)/0.82)] md:col-span-8">
          <p>
            Most AI writing apps talk in workflows. Second Voice talks in voices. It is about using
            AI not to replace your writing, but to reveal another version of it.
          </p>
          <p>
            The author choices are not there to clone anyone. They are shortcuts for tone: mythic,
            sharp, moral, plain. The point is to help the user judge their own sentence by hearing
            it from another angle.
          </p>
        </div>
      </div>
    </section>
  );
}
