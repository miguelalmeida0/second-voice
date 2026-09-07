"use client";

import {
  OUTCOMES,
  type OutcomeId,
  type OutcomeMeta,
} from "@/lib/ghostwriter-shared";

export function OutcomeOptions({
  disabled = false,
  onChange,
  options = OUTCOMES,
  value,
}: {
  disabled?: boolean;
  onChange: (outcome: OutcomeId) => void;
  options?: OutcomeMeta[];
  value: OutcomeId;
}) {
  return (
    <div className="gw-outcome-grid" role="group" aria-label="Outcome options">
      {options.map((option) => {
        const isSelected = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            data-outcome={option.id}
            data-selected={isSelected}
            className="gw-outcome-card"
            onClick={() => onChange(option.id)}
          >
            <span className="gw-outcome-status">
              {isSelected ? "Selected" : "Outcome"}
            </span>
            <span className="gw-outcome-title">{option.label}</span>
            <span className="gw-outcome-description">{option.trait}</span>
          </button>
        );
      })}
    </div>
  );
}
