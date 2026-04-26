const engineeringChoices = [
  {
    label: "01",
    title: "Stochastic generation, deterministic playback",
    body:
      "A single server inference produces the canonical rewrite. The client then derives a diff against the source and replays that edit graph locally, decoupling the feeling of live generation from token timing, partial-output states, and model-authored UI choreography.",
    signal: "The model is stochastic; the interaction after generation is replayable, testable, and deterministic.",
  },
  {
    label: "02",
    title: "Inference is gated before the provider boundary",
    body:
      "Before a model call is allowed, the browser request passes signed session validation, same-origin and CSRF checks, proof-of-work, replay protection, and layered rate limits. Abuse controls run before the request reaches the expensive path.",
    signal: "The public surface is designed like production infrastructure, not a local demo endpoint.",
  },
  {
    label: "03",
    title: "Sharing is separated from private inference",
    body:
      "A rewrite can remain purely private, or become an explicit public artifact. The share layer is designed around the rewritten output, with source text hidden by default so a useful permalink does not accidentally publish the user's draft.",
    signal: "Generation, persistence, and public visibility are treated as separate product states.",
  },
  {
    label: "04",
    title: "Provider behavior is explicit and bounded",
    body:
      "The app selects its AI provider through configuration instead of silent fallback, wraps model calls with timeout handling, and returns stable product errors instead of leaking vendor-specific failure details into the interface.",
    signal: "The model layer can vary; the product contract stays predictable.",
  },
];

export function CaseStudyEngineeringChoices() {
  return (
    <section className="py-20 md:py-28">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-5">
          <p className="cs-section-number mb-5">Engineering note</p>
          <h2 className="cs-font-serif-display text-4xl leading-[1.05] md:text-5xl">
            The invisible work is what makes the magic hold.
          </h2>
          <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[hsl(var(--cs-foreground)/0.76)]">
            The model call is intentionally narrow. Most of the product quality comes from the
            contracts around it: deterministic playback, abuse resistance, privacy-aware sharing,
            and bounded provider behavior.
          </p>
        </div>

        <div className="md:col-span-7">
          <div className="border-y border-[hsl(var(--cs-hairline))]">
            {engineeringChoices.map((choice) => (
              <article
                key={choice.title}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-5 border-b border-[hsl(var(--cs-hairline))] py-6 last:border-b-0"
              >
                <span className="cs-stack-index pt-1 text-[hsl(var(--cs-primary)/0.82)]">
                  {choice.label}
                </span>
                <div>
                  <h3 className="text-xl font-medium leading-tight text-[hsl(var(--cs-foreground))]">
                    {choice.title}
                  </h3>
                  <p className="mt-3 max-w-[66ch] text-[15px] leading-relaxed text-[hsl(var(--cs-muted-foreground))]">
                    {choice.body}
                  </p>
                  <p className="mt-4 inline-flex max-w-full rounded-full border border-[hsl(var(--cs-hairline))] bg-[hsl(var(--cs-surface)/0.7)] px-3 py-1.5 text-[13px] leading-snug text-[hsl(var(--cs-foreground)/0.78)]">
                    {choice.signal}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-7 border border-[hsl(var(--cs-hairline))] bg-[hsl(var(--cs-surface)/0.58)] p-5">
            <p className="cs-section-number mb-3">System contract</p>
            <p className="font-[var(--font-jetbrains-mono)] text-[13px] leading-relaxed text-[hsl(var(--cs-foreground)/0.78)]">
              text + author + mood -&gt; final rewrite -&gt; client diff playback -&gt; optional public artifact
            </p>
          </div>

          <div className="mt-5 border border-[hsl(var(--cs-hairline))] bg-[hsl(var(--cs-surface)/0.58)] p-5">
            <p className="cs-section-number mb-3">Rewrite Lab</p>
            <h3 className="cs-font-serif-display text-2xl leading-[1.08] text-[hsl(var(--cs-foreground))]">
              From single output to observable generation
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--cs-muted-foreground))]">
              The first version returned one rewrite. Rewrite Lab turns that into a small AI pipeline:
              parallel candidate generation, structured evaluation, deterministic winner selection,
              and a visible trace. The interaction stays simple for users, but the system exposes the
              product contract that makes the result trustworthy.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
