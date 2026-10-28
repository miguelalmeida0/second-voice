"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { RewriteReview } from "./RewriteReview";

const source = "The rain stopped. Mara waited by the bridge.\n\nShe kept the letter in her coat pocket.";
const result = "The rain softened. Mara lingered by the bridge.\n\nShe kept the letter close.";

export function RewriteReviewPreview() {
  const [open, setOpen] = useState(true);
  const resume = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!open) resume.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <main className="ghostwriter gw-studio relative min-h-dvh overflow-x-clip">
      <div className="gw-studio-shell">
        <header className="duet-header">
          <div className="duet-brand">
            <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
              <path d="M10 7h11l-6 21H4z" /><path d="M19 3h10l-6 21H13z" />
            </svg>
            <h1>Second Voice</h1>
          </div>
          <nav aria-label="Sample preview" style={{ paddingRight: 0, flexWrap: "wrap", columnGap: 16 }}>
            <button type="button" onClick={() => setOpen(false)}>Sample review · No AI calls</button>
            <a href="https://secondvoice.miguelalmeida.xyz/" className="underline underline-offset-4">Open live editor</a>
          </nav>
        </header>
        {!open && (
          <div className="gw-studio-workspace">
            <section className="gw-studio-input" aria-label="Sample original">
              <p className="duet-index">01 / Prepared sample</p>
              <h2 className="duet-title">Your words.</h2>
              <p className="duet-note">This is a read-only sample. Use the live editor to write your own text and generate rewrites.</p>
              <p className="whitespace-pre-wrap text-lg leading-relaxed">{source}</p>
            </section>
            <section className="gw-studio-output" aria-label="Sample rewrite">
              <p className="duet-index">02 / Prepared rewrite</p>
              <h2 className="duet-title">Another voice.</h2>
              <div className="duet-controls">
                <p className="duet-canvas whitespace-pre-wrap text-lg leading-relaxed">{result}</p>
                <button ref={resume} type="button" className="gw-inspiration-rewrite" onClick={() => setOpen(true)}>Review sample</button>
              </div>
            </section>
          </div>
        )}
        <RewriteReview source={source} result={result} hidden={!open} onClose={() => setOpen(false)} backLabel="Back to sample" />
      </div>
    </main>
  );
}
