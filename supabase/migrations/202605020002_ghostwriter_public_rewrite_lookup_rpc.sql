create or replace function public.ghostwriter_public_rewrite_lookup(p_short_id text)
returns table (
  short_id text,
  author text,
  mood integer,
  input_text text,
  output_text text,
  created_at timestamptz,
  source_visible boolean,
  generation_source text,
  rewrite_mode text,
  outcome text,
  lab_winner_label text,
  lab_winner_score integer,
  lab_selection_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rewrites.short_id,
    rewrites.author,
    rewrites.mood,
    case when rewrites.source_visible then rewrites.input_text else '' end as input_text,
    rewrites.output_text,
    rewrites.created_at,
    rewrites.source_visible,
    rewrites.generation_source,
    rewrites.rewrite_mode,
    case when rewrites.rewrite_mode = 'outcome' then rewrites.outcome else null end as outcome,
    case when rewrites.generation_source = 'rewrite_lab' then rewrites.lab_winner_label else null end as lab_winner_label,
    case when rewrites.generation_source = 'rewrite_lab' then rewrites.lab_winner_score else null end as lab_winner_score,
    case when rewrites.generation_source = 'rewrite_lab' then rewrites.lab_selection_reason else null end as lab_selection_reason
  from public.ghostwriter_rewrites as rewrites
  where
    p_short_id ~ '^[abcdefghijkmnopqrstuvwxyz23456789]{8}$'
    and rewrites.short_id = p_short_id
    and rewrites.is_public = true
  limit 1;
$$;

comment on function public.ghostwriter_public_rewrite_lookup(text) is
  'Exact short-id public Ghostwriter artifact lookup. Prevents anonymous broad scans of the public artifact view.';

revoke all on function public.ghostwriter_public_rewrite_lookup(text) from public;
revoke all on function public.ghostwriter_public_rewrite_lookup(text) from anon;
revoke all on function public.ghostwriter_public_rewrite_lookup(text) from authenticated;
grant execute on function public.ghostwriter_public_rewrite_lookup(text) to anon;
grant execute on function public.ghostwriter_public_rewrite_lookup(text) to authenticated;

revoke select on table public.ghostwriter_public_rewrites from anon;
revoke select on table public.ghostwriter_public_rewrites from authenticated;
