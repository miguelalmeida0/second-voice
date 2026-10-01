import "../lib/server-only.ts";

import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import {
  NEGATIVE_REWRITE_FEEDBACK_REASONS,
  POSITIVE_REWRITE_FEEDBACK_REASONS,
  REWRITE_FEEDBACK_RATINGS,
  REWRITE_FEEDBACK_REASONS,
} from "@/lib/ghostwriter-feedback";
import { InputSchema, REWRITE_OUTPUT_MAX_CHARS } from "@/server/ghostwriter";
import { verifyRewriteArtifactToken } from "@/server/ghostwriter-artifact-token";
import { cleanupRewriteOutput } from "@/server/ghostwriter-quality";
import { logSecurityEvent } from "@/server/security-events";

type FeedbackRequestContext = {
  requestId?: string;
};

const RewriteFeedbackSubjectSchema = InputSchema.pick({
  author: true,
  mode: true,
  mood: true,
  outcome: true,
});
const POSITIVE_REASON_SET = new Set<string>(POSITIVE_REWRITE_FEEDBACK_REASONS);
const NEGATIVE_REASON_SET = new Set<string>(NEGATIVE_REWRITE_FEEDBACK_REASONS);

export const RewriteFeedbackSchema = RewriteFeedbackSubjectSchema.extend({
  artifactToken: z.string().min(32).max(4096),
  rating: z.enum(REWRITE_FEEDBACK_RATINGS),
  reason: z.enum(REWRITE_FEEDBACK_REASONS).optional(),
  rewrite: z.string().trim().min(1).max(REWRITE_OUTPUT_MAX_CHARS),
}).superRefine((feedback, context) => {
  if (!feedback.reason) {
    return;
  }

  const reasonMatchesRating =
    feedback.rating === "positive"
      ? POSITIVE_REASON_SET.has(feedback.reason)
      : NEGATIVE_REASON_SET.has(feedback.reason);

  if (!reasonMatchesRating) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Feedback reason does not match rating.",
      path: ["reason"],
    });
  }
});

export type RewriteFeedbackInput = z.infer<typeof RewriteFeedbackSchema>;

function rewriteHash(rewrite: string): string {
  return createHash("sha256").update(rewrite).digest("hex");
}

export async function recordRewriteFeedback(
  input: RewriteFeedbackInput,
  context: FeedbackRequestContext = {},
): Promise<{ error: string | null; status: number }> {
  const rewrite = cleanupRewriteOutput(input.rewrite);

  if (!rewrite || rewrite.length > REWRITE_OUTPUT_MAX_CHARS) {
    return {
      error: "Invalid feedback.",
      status: 400,
    };
  }

  const verifiedArtifact = verifyRewriteArtifactToken({
    artifactToken: input.artifactToken,
    author: input.author,
    mode: input.mode,
    mood: input.mood,
    outcome: input.outcome,
    rewrite,
  });

  if (!verifiedArtifact || verifiedArtifact.rewriteHash !== rewriteHash(rewrite)) {
    return {
      error: "Invalid feedback.",
      status: 400,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    logSecurityEvent("feedback_storage_unavailable", {
      requestId: context.requestId,
    });
    return {
      error: "Feedback is temporarily unavailable.",
      status: 503,
    };
  }

  const rewriteMode = verifiedArtifact.mode;
  const { error } = await ((supabaseAdmin.from("ghostwriter_feedback") as unknown) as {
    insert: (value: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>;
  }).insert({
    author: verifiedArtifact.author,
    generation_source: verifiedArtifact.generationSource,
    lab_selection_reason: verifiedArtifact.labSelectionReason,
    lab_winner_label: verifiedArtifact.labWinnerLabel,
    lab_winner_score: verifiedArtifact.labWinnerScore,
    mood: verifiedArtifact.mood,
    outcome: verifiedArtifact.outcome,
    rating: input.rating,
    reason: input.reason ?? null,
    request_id: context.requestId ?? null,
    rewrite_mode: rewriteMode,
    rewrite_hash: verifiedArtifact.rewriteHash,
    rewrite_short_id: null,
  });

  if (error) {
    logSecurityEvent("rewrite_feedback_failed", {
      code: error.code,
      message: error.message,
      requestId: context.requestId,
    });

    return {
      error: "Feedback is temporarily unavailable.",
      status: 503,
    };
  }

  logSecurityEvent("rewrite_feedback_recorded", {
    author: verifiedArtifact.author,
    generationSource: verifiedArtifact.generationSource,
    hasPublicArtifact: false,
    outcome: rewriteMode === "outcome" ? verifiedArtifact.outcome : "none",
    rating: input.rating,
    reason: input.reason ?? "none",
    requestId: context.requestId,
    rewriteMode,
  });

  return {
    error: null,
    status: 200,
  };
}
