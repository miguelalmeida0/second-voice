export function RewriteGuide({ hasDraft }: { hasDraft: boolean }) {
  return <section className="duet-guide" aria-label="Rewrite preview">
    <p>{hasDraft ? "Choose a voice, then rewrite." : "Your rewrite will appear here."}</p>
  </section>;
}
