const stack = [
  {
    name: "Next.js",
    body: "Gives the product a fast App Router shell for the main page, case note, API route, and share pages.",
  },
  {
    name: "React",
    body: "Keeps the mood dial, author switcher, and rewrite playback responsive without turning the page into a heavy app.",
  },
  {
    name: "Groq-powered AI layer",
    body: "Groq keeps the rewrite path fast enough to feel responsive while staying constrained around author lens, mood, and source text.",
  },
  {
    name: "Supabase",
    body: "Stores shareable rewrites lightly, enough for permalinks without adding accounts or a document system.",
  },
];

export function CaseStudyWhyThisStack() {
  return (
    <section className="py-20 md:py-28">
      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-12">
        <h2 className="cs-font-serif-display text-4xl leading-[1.05] tracking-tight md:col-span-5 md:text-5xl">
          The stack serves the feeling
        </h2>
        <p className="max-w-[54ch] border-t border-[hsl(var(--cs-hairline))] pt-5 text-[17px] leading-relaxed text-[hsl(var(--cs-muted-foreground))] md:col-span-7">
          The technology is there to keep the interaction fast, expressive, and easy to share,
          without making the product feel complicated or dragging it into dashboard territory.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-[hsl(var(--cs-hairline))] pt-7 md:grid-cols-2">
        {stack.map((item, index) => (
          <li
            key={item.name}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-[hsl(var(--cs-hairline))] pb-6"
          >
            <span className="cs-stack-index pt-1">
              /{String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="text-base font-medium text-[hsl(var(--cs-foreground))]">
                {item.name}
              </h3>
              <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed text-[hsl(var(--cs-muted-foreground))]">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
