import "../lib/server-only.ts";

import { z } from "zod";
import type { AiPolicyConfig } from "./ai-policy.ts";
import { readLimitedJsonResponse } from "./ai-provider-http.ts";
import { validateRewriteProviderPayload } from "./ghostwriter-quality.ts";

const PROVIDER_RESPONSE_MAX_BYTES = 64 * 1024;

const ProviderUsageSchema = z.object({
  completion_tokens: z.number().int().nonnegative(),
  prompt_tokens: z.number().int().nonnegative(),
});

const ProviderEnvelopeSchema = z.object({
  id: z.string().max(256).optional(),
  usage: ProviderUsageSchema,
});

export type AiProviderResult = {
  completionTokens: number;
  promptTokens: number;
  providerRequestId: string | null;
  rewrite: string;
};

export class AiProviderDispatchError extends Error {
  readonly code: "malformed_response" | "provider_error" | "timeout_or_disconnect";

  constructor(code: AiProviderDispatchError["code"]) {
    super(code);
    this.name = "AiProviderDispatchError";
    this.code = code;
  }
}
export async function dispatchRewriteToProvider(options: {
  policy: AiPolicyConfig;
  system: string;
  user: string;
}): Promise<AiProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.policy.requestTimeoutMs);

  try {
    const response = await fetch(options.policy.providerUrl, {
      body: JSON.stringify({
        include_reasoning: false,
        max_completion_tokens: options.policy.maxOutputTokens,
        messages: [
          { content: options.system, role: "system" },
          { content: options.user, role: "user" },
        ],
        model: options.policy.model,
        n: 1,
        reasoning_effort: "low",
        stream: false,
        temperature: 0.6,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${options.policy.providerApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AiProviderDispatchError("provider_error");
    }

    const json = await readLimitedJsonResponse(response, PROVIDER_RESPONSE_MAX_BYTES, {
      signal: controller.signal,
    });
    const envelope = ProviderEnvelopeSchema.safeParse(json);
    const validatedRewrite = validateRewriteProviderPayload(json);

    if (!envelope.success || !validatedRewrite.ok) {
      throw new AiProviderDispatchError("malformed_response");
    }

    return {
      completionTokens: envelope.data.usage.completion_tokens,
      promptTokens: envelope.data.usage.prompt_tokens,
      providerRequestId:
        response.headers.get("x-request-id") ||
        response.headers.get("x-groq-id") ||
        envelope.data.id ||
        null,
      rewrite: validatedRewrite.rewrite,
    };
  } catch (error) {
    if (error instanceof AiProviderDispatchError) {
      throw error;
    }

    throw new AiProviderDispatchError("timeout_or_disconnect");
  } finally {
    clearTimeout(timeout);
  }
}
