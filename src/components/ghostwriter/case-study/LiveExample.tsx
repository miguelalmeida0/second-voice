"use client";

import { useState } from "react";

const treatments = [
  {
    label: "warmer",
    text: "AI writing does not have to be only about speed. It can also help a sentence feel more alive.",
  },
  {
    label: "stranger",
    text: "The model becomes a second ear: not replacing the sentence, just letting it echo differently.",
  },
  {
    label: "plainer",
    text: "The app uses AI to help people hear another version of their own sentence.",
  },
];

export function CaseStudyLiveExample() {
  const [active, setActive] = useState(0);
  const current = treatments[active];

  return (
    <div className="relative">
      <div className="cs-example-panel">
        <div>
          <span className="cs-eyebrow">One sentence, three treatments</span>
          <p className="mt-5 text-sm leading-relaxed text-[hsl(var(--cs-muted-foreground))]">
            Source
          </p>
          <p className="mt-2 max-w-[28ch] text-[18px] leading-relaxed text-[hsl(var(--cs-foreground)/0.9)] sm:max-w-none">
            AI writing can be more than acceleration; it can be a way to hear language differently.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {treatments.map((treatment, index) => (
            <button
              key={treatment.label}
              type="button"
              aria-pressed={index === active}
              data-active={index === active}
              onClick={() => setActive(index)}
              className="cs-treatment-button"
            >
              {treatment.label}
            </button>
          ))}
        </div>

        <div className="mt-8 border-t border-[hsl(var(--cs-hairline))] pt-6">
          <p className="cs-eyebrow">{current.label}</p>
          <p
            key={current.label}
            aria-live="polite"
            className="animate-cs-fade-up mt-4 min-h-[124px] max-w-[28ch] text-[21px] leading-relaxed text-[hsl(var(--cs-foreground))] sm:max-w-none"
          >
            {current.text}
          </p>
        </div>
      </div>
    </div>
  );
}
