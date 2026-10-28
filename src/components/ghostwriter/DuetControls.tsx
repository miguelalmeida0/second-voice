import { AUTHORS, MOOD_NAME, OUTCOMES, moodLabelFor, type AuthorId, type OutcomeId, type RewriteMode } from "@/lib/ghostwriter-shared";

export function DuetControls({ mode, author, mood, outcome, disabled, onMode, onAuthor, onMood, onOutcome }: {
  mode: RewriteMode; author: AuthorId; mood: number; outcome: OutcomeId; disabled: boolean;
  onMode: (mode: RewriteMode) => void;
  onAuthor: (author: AuthorId) => void;
  onMood: (mood: number) => void;
  onOutcome: (outcome: OutcomeId) => void;
}) {
  return <section className="duet-controls" aria-label="Rewrite settings">
    <label className="duet-setting"><span>Mode</span>
      <select aria-label="Rewrite mode" value={mode} disabled={disabled} onChange={event => onMode(event.target.value as RewriteMode)}>
        <option value="author">Authors</option><option value="outcome">Outcomes</option>
      </select>
    </label>
    {mode === "author" ? <>
      <label className="duet-setting"><span>Author</span>
        <select aria-label="Author" value={author} disabled={disabled} onChange={event => onAuthor(event.target.value as AuthorId)}>
          {AUTHORS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="duet-setting duet-strength"><span>Strength <span aria-hidden="true">{mood}%</span></span>
        <input className="duet-compact-range" type="range" min={0} max={100} step={50} value={mood} disabled={disabled}
          aria-label={`Strength — ${MOOD_NAME[author]} mood dial`} aria-valuetext={`${mood}% ${moodLabelFor(author, mood)}`}
          onChange={event => onMood(Number(event.target.value))} />
      </label>
    </> : <label className="duet-setting duet-outcome-select"><span>Outcome</span>
      <select aria-label="Writing outcome" value={outcome} disabled={disabled} onChange={event => onOutcome(event.target.value as OutcomeId)}>
        {OUTCOMES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>}
  </section>;
}
