"use client";

import { AlertCircle, Check, LoaderCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import {
  NEGATIVE_REWRITE_FEEDBACK_REASONS,
  POSITIVE_REWRITE_FEEDBACK_REASONS,
  REWRITE_FEEDBACK_REASON_LABELS,
  type RewriteFeedbackRating,
  type RewriteFeedbackReason,
} from "@/lib/ghostwriter-feedback";

export type RewriteFeedbackSubmission = {
  rating: RewriteFeedbackRating;
  reason?: RewriteFeedbackReason;
};

type RewriteFeedbackState =
  | { kind: "idle"; rating: RewriteFeedbackRating | null }
  | { kind: "saving"; rating: RewriteFeedbackRating; reason?: RewriteFeedbackReason }
  | { kind: "saved"; rating: RewriteFeedbackRating; reason?: RewriteFeedbackReason }
  | { kind: "error"; message: string; rating: RewriteFeedbackRating | null };

const RATING_OPTIONS = [
  {
    icon: ThumbsUp,
    label: "Landed",
    value: "positive",
  },
  {
    icon: ThumbsDown,
    label: "Missed",
    value: "negative",
  },
] as const;

function reasonsFor(rating: RewriteFeedbackRating | null): readonly RewriteFeedbackReason[] {
  if (rating === "positive") {
    return POSITIVE_REWRITE_FEEDBACK_REASONS;
  }

  if (rating === "negative") {
    return NEGATIVE_REWRITE_FEEDBACK_REASONS;
  }

  return [];
}

export function RewriteFeedbackPanel({
  disabled = false,
  onSubmit,
  runId,
}: {
  disabled?: boolean;
  onSubmit: (submission: RewriteFeedbackSubmission) => Promise<void>;
  runId: number;
}) {
  const [state, setState] = useState<{ runId: number; value: RewriteFeedbackState }>({
    runId,
    value: { kind: "idle", rating: null },
  });
  const value: RewriteFeedbackState =
    state.runId === runId ? state.value : { kind: "idle", rating: null };
  const selectedRating = value.rating;
  const saving = value.kind === "saving";

  async function submitFeedback(rating: RewriteFeedbackRating, reason?: RewriteFeedbackReason) {
    if (disabled || saving) {
      return;
    }

    setState({ runId, value: { kind: "saving", rating, reason } });

    try {
      await onSubmit({ rating, reason });
      setState({ runId, value: { kind: "saved", rating, reason } });
    } catch (error) {
      setState({
        runId,
        value: {
          kind: "error",
          message: error instanceof Error ? error.message : "Feedback could not be saved.",
          rating,
        },
      });
    }
  }

  return (
    <div className="gw-feedback-panel" data-state={value.kind}>
      <div className="gw-feedback-heading">
        <p>Did this edit land?</p>
        {value.kind === "saving" ? (
          <span role="status">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Saving
          </span>
        ) : null}
        {value.kind === "saved" ? (
          <span>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Captured
          </span>
        ) : null}
      </div>

      <div className="gw-feedback-rating-row">
        {RATING_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = selectedRating === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className="gw-feedback-rating"
              data-selected={selected}
              disabled={disabled || saving}
              onClick={() => setState({ runId, value: { kind: "idle", rating: option.value } })}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {option.label}
            </button>
          );
        })}
      </div>

      {selectedRating ? (
        <div className="gw-feedback-reasons" aria-label="Feedback reasons">
          {reasonsFor(selectedRating).map((reason) => (
            <button
              key={reason}
              type="button"
              className="gw-feedback-reason"
              disabled={disabled || saving}
              onClick={() => void submitFeedback(selectedRating, reason)}
            >
              {REWRITE_FEEDBACK_REASON_LABELS[reason]}
            </button>
          ))}
          <button
            type="button"
            className="gw-feedback-reason"
            disabled={disabled || saving}
            onClick={() => void submitFeedback(selectedRating)}
          >
            Just send
          </button>
        </div>
      ) : null}

      {value.kind === "error" ? (
        <div className="gw-feedback-error" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>{value.message}</span>
        </div>
      ) : null}
    </div>
  );
}
