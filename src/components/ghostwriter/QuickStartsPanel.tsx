import { ArrowRight, Cat, ChevronDown, CloudRain, Feather, FileText, LoaderCircle, Mountain, PenLine } from "lucide-react";
import { SAMPLES } from "@/lib/ghostwriter-shared";
import { useDuetActionDock } from "./useDuetActionDock";
import { QUICK_DRAFTS } from "@/lib/voice-preview";

const DETAILS = [
  { icon: CloudRain, description: "Turn a moment into meaning" },
  { icon: FileText, description: "Write with perspective" },
  { icon: Feather, description: "Calm, kind, and human" },
  { icon: Mountain, description: "Let your imagination roam" },
  { icon: Cat, description: "Small moments, bigger ideas" },
  { icon: PenLine, description: "Close the day with clarity" },
];

export function QuickStartsPanel({ input, onSelect, onRewrite, loading, canRewrite, completed, status, actionsOnly = false, promptsOnly = false, promptsOpen = false, onPromptsOpenChange }: {
  actionsOnly?: boolean;
  promptsOnly?: boolean;
  promptsOpen?: boolean;
  onPromptsOpenChange?: (open: boolean) => void;
  input: string;
  onSelect: (text: string) => void;
  onRewrite?: () => void;
  loading?: boolean;
  canRewrite?: boolean;
  completed?: boolean;
  status?: string | null;
}) {
  const actionRef = useDuetActionDock(!promptsOnly);
  // Keep the policy's exact wording; put the first sentence near the action.
  const sentenceEnd = status?.indexOf(". ") ?? -1;
  const allowance = sentenceEnd >= 0 ? status!.slice(0, sentenceEnd + 1) : status;
  const statusDetail = sentenceEnd >= 0 ? status!.slice(sentenceEnd + 2) : null;
  const actionableDetail = statusDetail?.startsWith("Sign in with GitHub any time") ? null : statusDetail;
  const actionLabel = loading ? "Rewriting…" : completed ? "Rewrite again" : "Rewrite my draft";
  return (
    <section className={promptsOnly ? "gw-inspiration duet-prompts" : "gw-inspiration duet-actions"} aria-label={promptsOnly ? "Quick starts" : "Rewrite actions"}>
      {!promptsOnly && <><div ref={actionRef} className="duet-action-primary">
        <button type="button" className="gw-inspiration-rewrite" aria-describedby="duet-action-hint duet-action-allowance" onClick={onRewrite} disabled={!canRewrite}>
          <span>{actionLabel}</span>
          {loading ? <LoaderCircle aria-hidden="true" /> : null}
          {!loading ? <ArrowRight aria-hidden="true" /> : null}
        </button>
        <div className="duet-action-copy">
        <p id="duet-action-hint" className="duet-action-hint">{!input.trim() ? "Add text to enable rewriting." : "Uses 1 rewrite."}</p>
        {allowance ? <p id="duet-action-allowance" className="gw-inspiration-status" role="status">{allowance}</p> : <span id="duet-action-allowance" className="sr-only" />}
        </div>
      </div>
      {actionableDetail ? <p className="gw-inspiration-status-detail">{actionableDetail}</p> : null}
      </>}
      {!actionsOnly && <>
      <p className="duet-start-label">Nothing to paste? Start from one of these.</p>
      <div className="duet-quick-drafts">{QUICK_DRAFTS.map(sample => <button type="button" key={sample.label} aria-pressed={input === sample.text} onClick={() => onSelect(sample.text)}>{sample.label}</button>)}</div>
      <header className="gw-inspiration-heading">
        <h2 id="gw-inspiration-title">Quick starts</h2>
        <p className="gw-inspiration-intro">Find a first line.</p>
      </header>
      <button type="button" className="gw-inspiration-toggle" aria-expanded={promptsOpen} aria-controls="gw-inspiration-prompts" onClick={() => onPromptsOpenChange?.(!promptsOpen)}>
        <span>More quick starts <small>Find a first line</small></span><ChevronDown aria-hidden="true" />
      </button>
      <div id="gw-inspiration-prompts" className="gw-inspiration-prompts" data-open={promptsOpen}>
        {SAMPLES.map((sample, index) => {
          const { icon: Icon, description } = DETAILS[index];
          return (
            <button key={sample.label} type="button" className="gw-inspiration-prompt" aria-label={sample.label} aria-pressed={input === sample.text} onClick={() => onSelect(sample.text)}>
              <Icon aria-hidden="true" />
              <span><strong>{sample.label}</strong><small className="sr-only">{description}</small></span>
            </button>
          );
        })}
      </div>
      </>}
    </section>
  );
}
