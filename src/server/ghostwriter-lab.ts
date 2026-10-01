import "../lib/server-only.ts";

import { z } from "zod";

export const LAB_SOURCE_MAX_LENGTH = 1_200;

export const RewriteLabInputSchema = z
  .object({
    author: z.enum(["hemingway", "tolkien", "tolstoy", "stephenking"]),
    baselineRewrite: z.string().trim().min(1).max(3_000),
    mood: z.number().int().min(0).max(100).default(50),
    source: z.string().trim().min(1).max(LAB_SOURCE_MAX_LENGTH),
  })
  .strict();

/**
 * Rewrite Lab previously issued three parallel generations plus an evaluator call.
 * Live multi-pass AI is intentionally unavailable for the initial closed beta.
 */
export async function runRewriteLab(
  _data?: unknown,
  _context?: unknown,
): Promise<{
  error: string;
  lab: null;
  status: 503;
}> {
  void _data;
  void _context;

  return {
    error: "Rewrite Lab is disabled while the closed-beta cost boundary is in force.",
    lab: null,
    status: 503,
  };
}
