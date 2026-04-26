import "../lib/server-only.ts";

import {
  getSupabaseAdmin,
  getSupabasePublic,
} from "@/integrations/supabase/client.server";
import { publicSharingEnabled } from "@/lib/security-env";

export type GhostwriterFeatureAvailability = {
  feedbackEnabled: boolean;
  publicSharingEnabled: boolean;
};

export function getGhostwriterFeatureAvailability(): GhostwriterFeatureAvailability {
  const hasWritableStore = Boolean(getSupabaseAdmin());
  const hasPublicReadStore = Boolean(getSupabasePublic());

  return {
    feedbackEnabled: hasWritableStore,
    publicSharingEnabled:
      publicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING) &&
      hasWritableStore &&
      hasPublicReadStore,
  };
}
