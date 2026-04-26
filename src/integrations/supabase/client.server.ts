import "../../lib/server-only.ts";

import { createClient } from "@supabase/supabase-js";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GhostwriterAuthorId =
  | "hemingway"
  | "tolkien"
  | "tolstoy"
  | "stephenking"
  | "didion"
  | "graham"
  | "naval";

type GhostwriterGenerationSource = "single_rewrite" | "rewrite_lab";

export type Database = {
  public: {
    Tables: {
      ghostwriter_abuse_counters: {
        Row: {
          hit_count: number;
          key_hash: string;
          updated_at: string;
          window_ms: number;
          window_start: string;
        };
        Insert: {
          hit_count?: number;
          key_hash: string;
          updated_at?: string;
          window_ms: number;
          window_start?: string;
        };
        Update: Partial<{
          hit_count: number;
          key_hash: string;
          updated_at: string;
          window_ms: number;
          window_start: string;
        }>;
        Relationships: [];
      };
      ghostwriter_abuse_penalties: {
        Row: {
          blocked_until: string;
          key_hash: string;
          score: number;
          updated_at: string;
        };
        Insert: {
          blocked_until: string;
          key_hash: string;
          score?: number;
          updated_at?: string;
        };
        Update: Partial<{
          blocked_until: string;
          key_hash: string;
          score: number;
          updated_at: string;
        }>;
        Relationships: [];
      };
      ghostwriter_rewrites: {
        Row: {
          author: GhostwriterAuthorId;
          created_at: string;
          generation_source: GhostwriterGenerationSource;
          id: string;
          input_text: string;
          is_public: boolean;
          lab_selection_reason: string | null;
          lab_winner_label: string | null;
          lab_winner_score: number | null;
          mood: number;
          output_text: string;
          short_id: string;
          source_visible: boolean;
        };
        Insert: {
          author: "hemingway" | "tolkien" | "tolstoy" | "stephenking";
          created_at?: string;
          generation_source?: GhostwriterGenerationSource;
          id?: string;
          input_text?: string;
          is_public?: boolean;
          lab_selection_reason?: string | null;
          lab_winner_label?: string | null;
          lab_winner_score?: number | null;
          mood: number;
          output_text: string;
          short_id: string;
          source_visible?: boolean;
        };
        Update: Partial<{
          author: GhostwriterAuthorId;
          created_at: string;
          generation_source: GhostwriterGenerationSource;
          id: string;
          input_text: string;
          is_public: boolean;
          lab_selection_reason: string | null;
          lab_winner_label: string | null;
          lab_winner_score: number | null;
          mood: number;
          output_text: string;
          short_id: string;
          source_visible: boolean;
        }>;
        Relationships: [];
      };
      ghostwriter_feedback: {
        Row: {
          author: "hemingway" | "tolkien" | "tolstoy" | "stephenking";
          created_at: string;
          generation_source: GhostwriterGenerationSource;
          id: string;
          lab_selection_reason: string | null;
          lab_winner_label: string | null;
          lab_winner_score: number | null;
          mood: number;
          rating: "positive" | "negative";
          reason:
            | "useful"
            | "great_voice"
            | "fresh_wording"
            | "changed_meaning"
            | "too_generic"
            | "wrong_voice"
            | null;
          request_id: string | null;
          rewrite_hash: string;
          rewrite_short_id: string | null;
        };
        Insert: {
          author: "hemingway" | "tolkien" | "tolstoy" | "stephenking";
          created_at?: string;
          generation_source?: GhostwriterGenerationSource;
          id?: string;
          lab_selection_reason?: string | null;
          lab_winner_label?: string | null;
          lab_winner_score?: number | null;
          mood: number;
          rating: "positive" | "negative";
          reason?:
            | "useful"
            | "great_voice"
            | "fresh_wording"
            | "changed_meaning"
            | "too_generic"
            | "wrong_voice"
            | null;
          request_id?: string | null;
          rewrite_hash: string;
          rewrite_short_id?: string | null;
        };
        Update: Partial<{
          author: "hemingway" | "tolkien" | "tolstoy" | "stephenking";
          created_at: string;
          generation_source: GhostwriterGenerationSource;
          id: string;
          lab_selection_reason: string | null;
          lab_winner_label: string | null;
          lab_winner_score: number | null;
          mood: number;
          rating: "positive" | "negative";
          reason:
            | "useful"
            | "great_voice"
            | "fresh_wording"
            | "changed_meaning"
            | "too_generic"
            | "wrong_voice"
            | null;
          request_id: string | null;
          rewrite_hash: string;
          rewrite_short_id: string | null;
        }>;
        Relationships: [];
      };
      ghostwriter_used_challenges: {
        Row: {
          challenge_hash: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          challenge_hash: string;
          created_at?: string;
          expires_at: string;
        };
        Update: Partial<{
          challenge_hash: string;
          created_at: string;
          expires_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: {
      ghostwriter_public_rewrites: {
        Row: {
          author: GhostwriterAuthorId;
          created_at: string;
          generation_source: GhostwriterGenerationSource;
          input_text: string;
          lab_selection_reason: string | null;
          lab_winner_label: string | null;
          lab_winner_score: number | null;
          mood: number;
          output_text: string;
          short_id: string;
          source_visible: boolean;
        };
      };
    };
    Functions: {
      ghostwriter_abuse_apply_penalty: {
        Args: {
          p_key_hashes?: string[] | null;
          p_now?: string | null;
          p_severity?: number | null;
        };
        Returns: number;
      };
      ghostwriter_abuse_cleanup: {
        Args: {
          p_now?: string | null;
        };
        Returns: Json;
      };
      ghostwriter_abuse_consume: {
        Args: {
          p_now?: string | null;
          p_penalty_key_hashes?: string[] | null;
          p_rules?: Json | null;
        };
        Returns: Json;
      };
      ghostwriter_abuse_consume_challenge: {
        Args: {
          p_challenge_hash?: string | null;
          p_expires_at?: string | null;
          p_now?: string | null;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;
type SupabasePublicClient = ReturnType<typeof createClient<Database>>;

let cachedAdmin: SupabaseAdminClient | null | undefined;
let cachedPublic: SupabasePublicClient | null | undefined;

function buildClient(key: string): ReturnType<typeof createClient<Database>> {
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseAdmin(): SupabaseAdminClient | null {
  if (cachedAdmin !== undefined) {
    return cachedAdmin;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    cachedAdmin = null;
    return cachedAdmin;
  }

  cachedAdmin = buildClient(serviceRoleKey);
  return cachedAdmin;
}

export function getSupabasePublic(): SupabasePublicClient | null {
  if (cachedPublic !== undefined) {
    return cachedPublic;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    cachedPublic = null;
    return cachedPublic;
  }

  cachedPublic = buildClient(publishableKey);
  return cachedPublic;
}

export function __resetSupabaseClientsForTests() {
  cachedAdmin = undefined;
  cachedPublic = undefined;
}
