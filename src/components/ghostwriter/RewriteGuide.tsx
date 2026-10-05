import type { RewriteMode } from "@/lib/ghostwriter-shared";

export function RewriteGuide({ hasDraft, mode }: { hasDraft: boolean; mode: RewriteMode }) {
  return <section className="duet-guide" aria-label="How to start your rewrite">
    <h3>{hasDraft ? "Ready for another voice." : "Start with your words."}</h3>
    <p>{hasDraft ? "Your draft is ready. Choose a direction, then rewrite." : "Add a draft or pick a quick start. Your rewrite will appear here."}</p>
    <ol>
      <li><span>1</span> Write or paste your draft.</li>
      <li><span>2</span> {mode === "author" ? "Choose an author and strength." : "Choose a goal for your writing."}</li>
      <li><span>3</span> Press <strong>Rewrite my draft</strong>, then compare.</li>
    </ol>
  </section>;
}
