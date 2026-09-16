"use client";

import { OUTCOMES, type OutcomeId } from "@/lib/ghostwriter-shared";

function outcomeDescription(label: string): string {
  const normalized = label.toLowerCase();

  if (normalized.includes("clarity")) {
    return "Clearer, smoother, easier to understand.";
  }

  if (normalized.includes("reply")) {
    return "Warm, direct, easy to answer.";
  }

  if (normalized.includes("confident")) {
    return "Assured, grounded, never pushy.";
  }

  if (normalized.includes("concise")) {
    return "Shorter, sharper, still natural.";
  }

  if (normalized.includes("persuasive")) {
    return "A stronger case with a human tone.";
  }

  return "Shape the rewrite toward this goal.";
}

export function OutcomeOptions({
  value,
  disabled = false,
  onChange,
}: {
  value: OutcomeId;
  disabled?: boolean;
  onChange: (value: OutcomeId) => void;
}) {
  return (
    <div className="gw-outcome-choices" role="group" aria-label="Outcome options">
      {OUTCOMES.map((outcome) => {
        const selected = outcome.id === value;

        const description = outcomeDescription(outcome.label);

        return (
          <button
            key={outcome.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            data-selected={selected}
            onClick={() => onChange(outcome.id)}
            className="gw-outcome-choice disabled:cursor-not-allowed disabled:opacity-50"
          >
            <strong className="gw-outcome-choice-title">
              {outcome.label}
            </strong>

            <span className="gw-outcome-choice-description">
              {description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
