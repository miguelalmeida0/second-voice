"use client";

export type RewriteMode = "author" | "outcome";

export function RewriteModeSelector({
  value,
  disabled = false,
  onChange,
}: {
  value: RewriteMode;
  disabled?: boolean;
  onChange: (value: RewriteMode) => void;
}) {
  return (
    <div
      className="sv-mode-switch"
      role="group"
      aria-label="Rewrite mode"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "author"}
        data-selected={value === "author"}
        onClick={() => onChange("author")}
        className="sv-mode-switch-button"
      >
        <AuthorIcon />
        <span>Authors</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "outcome"}
        data-selected={value === "outcome"}
        onClick={() => onChange("outcome")}
        className="sv-mode-switch-button"
      >
        <OutcomeIcon />
        <span>Outcomes</span>
      </button>
    </div>
  );
}

function AuthorIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.5-4 2.7-6 6.5-6s6 2 6.5 6" />
    </svg>
  );
}

function OutcomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M15 9 21 3" />
      <path d="M17 3h4v4" />
    </svg>
  );
}