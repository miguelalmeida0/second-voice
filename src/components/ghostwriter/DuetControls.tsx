import { StudioSelect } from "./StudioSelect";
import { AUTHORS, MOOD_NAME, OUTCOMES, moodLabelFor, type AuthorId, type OutcomeId, type RewriteMode } from "@/lib/ghostwriter-shared";

export function DuetControls({ mode, author, mood, outcome, disabled, onMode, onAuthor, onMood, onOutcome }: {
  mode: RewriteMode; author: AuthorId; mood: number; outcome: OutcomeId; disabled: boolean;
  onMode: (mode: RewriteMode) => void;
  onAuthor: (author: AuthorId) => void;
  onMood: (mood: number) => void;
  onOutcome: (outcome: OutcomeId) => void;
}) {
  return <section className="duet-controls" aria-label="Rewrite settings">
    <StudioSelect label="Mode" name="Rewrite mode" value={mode} disabled={disabled} onChange={onMode}
      options={[{ value: "author", label: "Authors" }, { value: "outcome", label: "Outcomes" }]} />
    {mode === "author" ? <>
      <StudioSelect label="Author" name="Author" value={author} disabled={disabled} onChange={onAuthor}
        options={AUTHORS.map(item => ({ value: item.id, label: item.name }))} />
      <label className="duet-setting duet-strength"><span>Strength <span aria-hidden="true">{mood}%</span></span>
        <input className="duet-compact-range" type="range" min={0} max={100} step={50} value={mood} disabled={disabled}
          aria-label={`Strength — ${MOOD_NAME[author]} mood dial`} aria-valuetext={`${mood}% ${moodLabelFor(author, mood)}`}
          onChange={event => onMood(Number(event.target.value))} />
      </label>
    </> : <StudioSelect className="duet-outcome-select" label="Outcome" name="Writing outcome" value={outcome}
      disabled={disabled} onChange={onOutcome} options={OUTCOMES.map(item => ({ value: item.id, label: item.label }))} />}

  </section>;
}
