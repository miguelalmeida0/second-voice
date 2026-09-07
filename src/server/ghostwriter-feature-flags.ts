import "../lib/server-only.ts";

import {
  getSupabaseAdmin,
  getSupabasePublic,
} from "@/integrations/supabase/client.server";
import { publicSharingEnabled, resolveAbuseStoreConfig } from "@/lib/security-env";
import { resolveAiPolicyConfig } from "@/server/ai-policy";

export type GhostwriterFeatureAvailability = {
  feedbackEnabled: boolean;
  publicSharingEnabled: boolean;
  rewriteLabEnabled: boolean;
  rewriteEnabled: boolean;
  rewriteUnavailableReason: string | null;
};

export function getGhostwriterFeatureAvailability(): GhostwriterFeatureAvailability {
  const e2eFixtureMode =
    process.env.NODE_ENV !== "production" &&
    process.env.GHOSTWRITER_E2E_FIXTURE_MODE?.trim().toLowerCase() === "true";
  const hasWritableStore = Boolean(getSupabaseAdmin());
  const hasPublicReadStore = Boolean(getSupabasePublic());
  const aiPolicy = resolveAiPolicyConfig();
  const abuseStore = resolveAbuseStoreConfig({
    mode: process.env.GHOSTWRITER_ABUSE_STORE_MODE,
    nodeEnv: process.env.NODE_ENV,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
  });
  const hasAbuseStore = Boolean(abuseStore.mode);
  const rewriteEnabled = e2eFixtureMode || (aiPolicy.enabled && hasAbuseStore);
  const rewriteUnavailableReason = rewriteEnabled
    ? null
    : !aiPolicy.enabled
    ? "Live rewrite is available only to explicitly enabled closed-beta accounts."
    : abuseStore.reason
      ? "Rewrite is temporarily unavailable because request protection is not configured."
      : null;

  return {
    feedbackEnabled: hasWritableStore && hasAbuseStore,
    publicSharingEnabled:
      publicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING) &&
      hasWritableStore &&
      hasPublicReadStore &&
      hasAbuseStore,
    rewriteLabEnabled: e2eFixtureMode,
    rewriteEnabled,
    rewriteUnavailableReason,
  };
}
