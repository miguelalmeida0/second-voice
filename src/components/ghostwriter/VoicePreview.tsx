import { AUTHORS, moodLabelFor, outcomeLabelFor, type AuthorId, type OutcomeId, type RewriteMode } from "@/lib/ghostwriter-shared";
import { OUTCOME_PREVIEWS, PREVIEW_SOURCE, voicePreview } from "@/lib/voice-preview";

export function VoicePreview({ author, mood, mode, outcome, onDismiss }: { author: AuthorId; mood: number; mode: RewriteMode; outcome: OutcomeId; onDismiss?: () => void }) {
  const name = AUTHORS.find(item => item.id === author)!.cardTitle;
  return <section className="duet-preview" aria-label="Free sample preview">
    <div className="duet-preview-meta"><span>Free preview on a sample line</span><span>{mode === "author" ? `${name} · ${moodLabelFor(author, mood)}` : outcomeLabelFor(outcome)}</span></div>
    <p className="duet-preview-source">“{PREVIEW_SOURCE}”</p>
    <p className="duet-preview-text" aria-live="polite" aria-atomic="true">{mode === "author" ? voicePreview(author, mood) : OUTCOME_PREVIEWS[outcome]}</p>
    {onDismiss && <button type="button" className="duet-example-back" onClick={onDismiss}>Back to your draft</button>}
  </section>;
}
