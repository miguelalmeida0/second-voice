const changes = [
  {
    title: "The app got smaller",
    before: "Early versions wanted account-shaped features: saved work, a dashboard, a heavier library.",
    after: "I kept the product closer to a desk scrap: write something, tune it, optionally share the result.",
  },
  {
    title: "The language got quieter",
    before: "Early copy was trying too hard. It made the app sound bigger and slicker than it actually was.",
    after: "The final copy tries to be more honest about what the app does: it helps you hear a line differently.",
  },
  {
    title: "The author idea stayed",
    before: "Author names are instantly legible, but they can make the product feel like a party trick if the UI is careless.",
    after: "I kept them because people understand the choice immediately. The surrounding copy has to be clear: the author is a direction for the rewrite, not a claim that the app becomes that person.",
  },
];

export function CaseStudyWhatChanged() {
  return (
    <section className="py-20 md:py-28">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-4">
          <h2 className="cs-font-serif-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            What changed while building it
          </h2>
        </div>

        <div className="md:col-span-8">
          <div className="divide-y divide-[hsl(var(--cs-hairline))] border-y border-[hsl(var(--cs-hairline))]">
            {changes.map((change) => (
              <article key={change.title} className="grid grid-cols-1 gap-5 py-7 md:grid-cols-12 md:gap-8">
                <h3 className="cs-font-serif-display text-2xl leading-[1.08] text-[hsl(var(--cs-foreground))] md:col-span-4">
                  {change.title}
                </h3>
                <div className="space-y-4 text-[15px] leading-relaxed text-[hsl(var(--cs-muted-foreground))] md:col-span-8">
                  <p>
                    <span className="text-[hsl(var(--cs-foreground)/0.86)]">Before:</span>{" "}
                    {change.before}
                  </p>
                  <p>
                    <span className="text-[hsl(var(--cs-foreground)/0.86)]">After:</span>{" "}
                    {change.after}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
