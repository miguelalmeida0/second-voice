create table if not exists public.ghostwriter_feedback (
  id uuid primary key default gen_random_uuid(),
  rewrite_short_id text,
  author text not null,
  mood integer not null,
  generation_source text not null default 'single_rewrite',
  rating text not null,
  reason text,
  rewrite_hash text not null,
  lab_winner_label text,
  lab_winner_score integer,
  lab_selection_reason text,
  request_id text,
  created_at timestamptz not null default now(),
  constraint ghostwriter_feedback_short_id_format_check
    check (rewrite_short_id is null or rewrite_short_id ~ '^[abcdefghijkmnopqrstuvwxyz23456789]{8}$'),
  constraint ghostwriter_feedback_author_check
    check (author in ('hemingway', 'tolkien', 'tolstoy', 'stephenking')),
  constraint ghostwriter_feedback_mood_check
    check (mood between 0 and 100),
  constraint ghostwriter_feedback_generation_source_check
    check (generation_source in ('single_rewrite', 'rewrite_lab')),
  constraint ghostwriter_feedback_rating_check
    check (rating in ('positive', 'negative')),
  constraint ghostwriter_feedback_reason_check
    check (
      reason is null
      or reason in (
        'useful',
        'great_voice',
        'fresh_wording',
        'changed_meaning',
        'too_generic',
        'wrong_voice'
      )
    ),
  constraint ghostwriter_feedback_reason_matches_rating_check
    check (
      reason is null
      or (
        rating = 'positive'
        and reason in ('useful', 'great_voice', 'fresh_wording')
      )
      or (
        rating = 'negative'
        and reason in ('changed_meaning', 'too_generic', 'wrong_voice')
      )
    ),
  constraint ghostwriter_feedback_rewrite_hash_check
    check (rewrite_hash ~ '^[a-f0-9]{64}$'),
  constraint ghostwriter_feedback_lab_winner_score_check
    check (lab_winner_score is null or lab_winner_score between 0 and 100),
  constraint ghostwriter_feedback_lab_winner_label_length_check
    check (lab_winner_label is null or char_length(lab_winner_label) between 1 and 80),
  constraint ghostwriter_feedback_lab_selection_reason_length_check
    check (lab_selection_reason is null or char_length(lab_selection_reason) between 1 and 280),
  constraint ghostwriter_feedback_lab_metadata_consistency_check
    check (
      (
        generation_source = 'single_rewrite'
        and lab_winner_label is null
        and lab_winner_score is null
        and lab_selection_reason is null
      )
      or
      (
        generation_source = 'rewrite_lab'
        and lab_winner_label is not null
        and lab_winner_score is not null
        and lab_selection_reason is not null
      )
    )
);

create index if not exists ghostwriter_feedback_created_at_idx
  on public.ghostwriter_feedback (created_at desc);

create index if not exists ghostwriter_feedback_quality_idx
  on public.ghostwriter_feedback (generation_source, rating, reason, created_at desc);

create index if not exists ghostwriter_feedback_short_id_idx
  on public.ghostwriter_feedback (rewrite_short_id)
  where rewrite_short_id is not null;

alter table public.ghostwriter_feedback enable row level security;

revoke all on table public.ghostwriter_feedback from public;
revoke all on table public.ghostwriter_feedback from anon;
revoke all on table public.ghostwriter_feedback from authenticated;
grant all on table public.ghostwriter_feedback to service_role;

comment on table public.ghostwriter_feedback is
  'Private quality feedback for Second Voice rewrites. Stores metadata and rewrite hash only; never stores source or rewritten text.';

comment on column public.ghostwriter_feedback.rewrite_hash is
  'SHA-256 hash of the cleaned rewrite text, used only to group quality signals without storing private text.';
