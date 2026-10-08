import { AuthorOrbital } from "./AuthorOrbital";
import type { ReactNode } from "react";
import { MoodDial } from "./MoodDial";
import { OutcomeOptions, outcomeDescription } from "./OutcomeOptions";
import { OUTCOMES, type AuthorId, type OutcomeId, type RewriteMode } from "@/lib/ghostwriter-shared";

export function DuetControls({ mode, author, mood, outcome, disabled, onAuthor, onMood, onOutcome, children, preview, modeSwitch }: {
  preview?: ReactNode;
  modeSwitch: ReactNode;
  children?: ReactNode;
  mode: RewriteMode; author: AuthorId; mood: number; outcome: OutcomeId; disabled: boolean;
  onAuthor: (author: AuthorId) => void;
  onMood: (mood: number) => void; onOutcome: (outcome: OutcomeId) => void;
}) {
  return <section className="duet-controls" aria-label={mode === "author" ? "Author and mood" : "Writing outcome"}>
    <div className="duet-voice">
      {modeSwitch}
      {mode === "author" ? <AuthorOrbital active={author} disabled={disabled} onSelect={onAuthor} /> : <OutcomeOptions value={outcome} disabled={disabled} onChange={onOutcome} />}
    </div>
    {preview}
    <div className="duet-followup">
    {mode === "author" ? <MoodDial preview author={author} value={mood} disabled={disabled} onChange={onMood} /> : <div className="duet-outcome-note"><h2>Your direction</h2><p>{OUTCOMES.find(item => item.id === outcome)?.label}</p><span>{outcomeDescription(OUTCOMES.find(item => item.id === outcome)?.label ?? "")}</span></div>}
    {children}
    </div>
  </section>;
}
