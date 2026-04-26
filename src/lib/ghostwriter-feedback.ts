export const REWRITE_FEEDBACK_RATINGS = ["positive", "negative"] as const;
export const REWRITE_FEEDBACK_REASONS = [
  "useful",
  "great_voice",
  "fresh_wording",
  "changed_meaning",
  "too_generic",
  "wrong_voice",
] as const;

export type RewriteFeedbackRating = (typeof REWRITE_FEEDBACK_RATINGS)[number];
export type RewriteFeedbackReason = (typeof REWRITE_FEEDBACK_REASONS)[number];

export const POSITIVE_REWRITE_FEEDBACK_REASONS = [
  "useful",
  "great_voice",
  "fresh_wording",
] as const satisfies readonly RewriteFeedbackReason[];

export const NEGATIVE_REWRITE_FEEDBACK_REASONS = [
  "changed_meaning",
  "too_generic",
  "wrong_voice",
] as const satisfies readonly RewriteFeedbackReason[];

export const REWRITE_FEEDBACK_REASON_LABELS: Record<RewriteFeedbackReason, string> = {
  changed_meaning: "Changed meaning",
  fresh_wording: "Fresh wording",
  great_voice: "Great voice",
  too_generic: "Too generic",
  useful: "Useful",
  wrong_voice: "Wrong voice",
};
