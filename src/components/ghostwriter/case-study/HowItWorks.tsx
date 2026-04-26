const decisions = [
  {
    title: "Authors as lenses",
    body: "The names give people an immediate tonal handle. For now, they are useful because they are readable, but the system is about tone, not impersonation.",
    detail: "A shortcut for mythic, sharp, moral, or plain language.",
  },
  {
    title: "The dial makes mood visible",
    body: "The slider removes the blank-prompt problem. Instead of asking someone to write instructions about tone, it gives them one physical choice to make.",
    detail: "Less prompt craft. More judgment.",
  },
  {
    title: "The rewrite appears as a change",
    body: "The output is easier to understand when it shows what moved. A staged change gives the user something to compare, not just a finished block to accept.",
    detail: "The interface slows the result down on purpose.",
  },
];

export function CaseStudyHowItWorks() {
  return (
    <section className="py-20 md:py-28">
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-12">
        <h2 className="cs-font-serif-display text-4xl leading-[1.05] tracking-tight md:col-span-5 md:text-5xl">
          Three decisions that shaped the interface
        </h2>
        <p className="max-w-[52ch] border-t border-[hsl(var(--cs-hairline))] pt-5 text-[17px] leading-relaxed text-[hsl(var(--cs-muted-foreground))] md:col-span-7">
          I tried to make the page feel like a tool someone can understand by touching it, not a
          demo that needs explaining first.
        </p>
      </div>

      <div className="cs-decision-list">
        {decisions.map((decision, index) => (
          <article key={decision.title} className="cs-decision-item">
            <div className="cs-section-number">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div>
              <h3 className="cs-font-serif-display text-3xl leading-[1.08] text-[hsl(var(--cs-foreground))] md:text-4xl">
                {decision.title}
              </h3>
              <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-[hsl(var(--cs-foreground)/0.78)]">
                {decision.body}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--cs-muted-foreground))]">
                {decision.detail}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
