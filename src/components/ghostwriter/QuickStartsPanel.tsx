import { useState } from "react";
import { ArrowRight, Cat, ChevronDown, CloudRain, Dices, Feather, FileText, LoaderCircle, Mountain, PenLine } from "lucide-react";
import { SAMPLES, type RewriteMode } from "@/lib/ghostwriter-shared";

const DETAILS = [
  { icon: CloudRain, description: "Turn a moment into meaning" },
  { icon: FileText, description: "Write with perspective" },
  { icon: Feather, description: "Calm, kind, and human" },
  { icon: Mountain, description: "Let your imagination roam" },
  { icon: Cat, description: "Small moments, bigger ideas" },
  { icon: PenLine, description: "Close the day with clarity" },
];

export function QuickStartsPanel({ input, mode, onSelect, onSurprise, onRewrite, loading, canRewrite, surpriseDisabled, label, status }: {
  input: string;
  mode: RewriteMode;
  onSelect: (text: string) => void;
  onSurprise: () => void;
  onRewrite: () => void;
  loading: boolean;
  canRewrite: boolean;
  surpriseDisabled: boolean;
  label: string;
  status: string | null;
}) {
  const [promptsOpen, setPromptsOpen] = useState(false);
  const surpriseDescription = mode === "author" ? "Random voice · uses 1 rewrite" : "Random outcome · uses 1 rewrite";
  // Split presentation only; keep the policy's exact dynamic message intact.
  const retryStart = status?.indexOf("Try again") ?? -1;
  return (
    <section className="gw-inspiration" aria-label="Rewrite and quick starts">
      <div className="gw-inspiration-actions">
        <button type="button" className="gw-inspiration-rewrite" onClick={() => { setPromptsOpen(false); onRewrite(); }} disabled={!canRewrite}>
          {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Feather aria-hidden="true" />}
          <span>{loading ? "Rewriting…" : label}</span>
          {!loading ? <ArrowRight aria-hidden="true" /> : null}
        </button>
        <button type="button" className="gw-inspiration-surprise" aria-label="Surprise me" aria-describedby="gw-surprise-description" onClick={onSurprise} disabled={surpriseDisabled}>
          <Dices aria-hidden="true" />
          <span><strong>Surprise me</strong><small id="gw-surprise-description">{surpriseDescription}</small></span>
        </button>
      </div>
      {status ? <p className="gw-inspiration-status" role="status">
        {retryStart > 0 ? <>{status.slice(0, retryStart)}<span className="gw-inspiration-status-detail">{status.slice(retryStart)}</span></> : status}
      </p> : null}
      <header className="gw-inspiration-heading">
        <h2 id="gw-inspiration-title">Quick starts</h2>
        <p className="gw-inspiration-intro">Find a first line.</p>
      </header>
      <button type="button" className="gw-inspiration-toggle" aria-expanded={promptsOpen} aria-controls="gw-inspiration-prompts" onClick={() => setPromptsOpen(open => !open)}>
        <span>Quick starts <small>Find a first line</small></span><ChevronDown aria-hidden="true" />
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
    </section>
  );
}
