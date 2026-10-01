alter table if exists public.ghostwriter_rewrites
  add column if not exists rewrite_mode text not null default 'author',
  add column if not exists outcome text;

update public.ghostwriter_rewrites
set
  rewrite_mode = 'author',
  outcome = null
where rewrite_mode is distinct from 'outcome';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_mode_check'
      and conrelid = 'public.ghostwriter_rewrites'::regclass
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_mode_check
      check (rewrite_mode in ('author', 'outcome'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_outcome_check'
      and conrelid = 'public.ghostwriter_rewrites'::regclass
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_outcome_check
      check (outcome is null or outcome in ('clarity', 'reply', 'confident', 'concise', 'persuasive'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_mode_outcome_consistency_check'
      and conrelid = 'public.ghostwriter_rewrites'::regclass
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_mode_outcome_consistency_check
      check (
        (rewrite_mode = 'author' and outcome is null)
        or
        (rewrite_mode = 'outcome' and outcome is not null)
      );
  end if;
end $$;

comment on column public.ghostwriter_rewrites.rewrite_mode is
  'Rewrite mode used to generate the artifact: author style or outcome optimization.';

comment on column public.ghostwriter_rewrites.outcome is
  'Outcome optimization target for outcome-mode rewrites.';

alter table if exists public.ghostwriter_feedback
  add column if not exists rewrite_mode text not null default 'author',
  add column if not exists outcome text;

update public.ghostwriter_feedback
set
  rewrite_mode = 'author',
  outcome = null
where rewrite_mode is distinct from 'outcome';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_feedback_mode_check'
      and conrelid = 'public.ghostwriter_feedback'::regclass
  ) then
    alter table public.ghostwriter_feedback
      add constraint ghostwriter_feedback_mode_check
      check (rewrite_mode in ('author', 'outcome'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_feedback_outcome_check'
      and conrelid = 'public.ghostwriter_feedback'::regclass
  ) then
    alter table public.ghostwriter_feedback
      add constraint ghostwriter_feedback_outcome_check
      check (outcome is null or outcome in ('clarity', 'reply', 'confident', 'concise', 'persuasive'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_feedback_mode_outcome_consistency_check'
      and conrelid = 'public.ghostwriter_feedback'::regclass
  ) then
    alter table public.ghostwriter_feedback
      add constraint ghostwriter_feedback_mode_outcome_consistency_check
      check (
        (rewrite_mode = 'author' and outcome is null)
        or
        (rewrite_mode = 'outcome' and outcome is not null)
      );
  end if;
end $$;

comment on column public.ghostwriter_feedback.rewrite_mode is
  'Rewrite mode associated with the feedback signal.';

comment on column public.ghostwriter_feedback.outcome is
  'Outcome optimization target associated with the feedback signal.';

drop view if exists public.ghostwriter_public_rewrites;

create view public.ghostwriter_public_rewrites
with (security_barrier = true) as
select
  short_id,
  author,
  mood,
  case when source_visible then input_text else '' end as input_text,
  output_text,
  created_at,
  source_visible,
  generation_source,
  rewrite_mode,
  case when rewrite_mode = 'outcome' then outcome else null end as outcome,
  case when generation_source = 'rewrite_lab' then lab_winner_label else null end as lab_winner_label,
  case when generation_source = 'rewrite_lab' then lab_winner_score else null end as lab_winner_score,
  case when generation_source = 'rewrite_lab' then lab_selection_reason else null end as lab_selection_reason
from public.ghostwriter_rewrites
where is_public = true;

comment on view public.ghostwriter_public_rewrites is
  'Public Ghostwriter artifacts with source text masked unless explicitly allowed and only public-safe mode/provenance metadata exposed.';

revoke all on table public.ghostwriter_public_rewrites from public;
grant select on table public.ghostwriter_public_rewrites to anon;
grant select on table public.ghostwriter_public_rewrites to authenticated;
