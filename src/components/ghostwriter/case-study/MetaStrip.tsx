const meta = [
  { label: "Made by", value: "Miguel" },
  { label: "Role", value: "product, design, engineering" },
  { label: "Kept small", value: "no accounts, no dashboard, no document editor" },
  { label: "Built with", value: "Next.js, React, AI rewrite API, Supabase" },
];

export function CaseStudyMetaStrip() {
  return (
    <section id="read" className="cs-project-note border-y border-[hsl(var(--cs-hairline))] py-8 md:py-10">
      <dl className="cs-note-row">
        {meta.map((item) => (
          <div key={item.label}>
            <dt className="cs-eyebrow mb-2">{item.label}</dt>
            <dd className="text-[15px] leading-relaxed text-[hsl(var(--cs-foreground)/0.84)] md:text-base">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
