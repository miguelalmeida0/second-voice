alter table if exists public.ghostwriter_rewrites
  add column if not exists generation_source text not null default 'single_rewrite',
  add column if not exists lab_winner_label text,
  add column if not exists lab_winner_score integer,
  add column if not exists lab_selection_reason text;

update public.ghostwriter_rewrites
set
  generation_source = 'single_rewrite',
  lab_winner_label = null,
  lab_winner_score = null,
  lab_selection_reason = null
where generation_source is distinct from 'rewrite_lab';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_generation_source_check'
      and conrelid = 'public.ghostwriter_rewrites'::regclass
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_generation_source_check
      check (generation_source in ('single_rewrite', 'rewrite_lab'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_lab_score_check'
      and conrelid = 'public.ghostwriter_rewrites'::regclass
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_lab_score_check
      check (lab_winner_score is null or lab_winner_score between 0 and 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_lab_metadata_length_check'
      and conrelid = 'public.ghostwriter_rewrites'::regclass
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_lab_metadata_length_check
      check (
        (lab_winner_label is null or char_length(lab_winner_label) between 1 and 80)
        and (lab_selection_reason is null or char_length(lab_selection_reason) between 1 and 280)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_lab_metadata_consistency_check'
      and conrelid = 'public.ghostwriter_rewrites'::regclass
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_lab_metadata_consistency_check
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
      );
  end if;
end $$;

comment on column public.ghostwriter_rewrites.generation_source is
  'How the stored artifact output was selected: single rewrite or Rewrite Lab winner.';

comment on column public.ghostwriter_rewrites.lab_winner_label is
  'Public-safe label for the applied Rewrite Lab candidate, when generation_source is rewrite_lab.';

comment on column public.ghostwriter_rewrites.lab_winner_score is
  'Public-safe overall Rewrite Lab score from 0 to 100, when generation_source is rewrite_lab.';

comment on column public.ghostwriter_rewrites.lab_selection_reason is
  'Short public-safe reason for the applied Rewrite Lab winner, when generation_source is rewrite_lab.';

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
  case when generation_source = 'rewrite_lab' then lab_winner_label else null end as lab_winner_label,
  case when generation_source = 'rewrite_lab' then lab_winner_score else null end as lab_winner_score,
  case when generation_source = 'rewrite_lab' then lab_selection_reason else null end as lab_selection_reason
from public.ghostwriter_rewrites
where is_public = true;

comment on view public.ghostwriter_public_rewrites is
  'Public Ghostwriter artifacts with source text masked unless explicitly allowed and only public-safe provenance metadata exposed.';

revoke all on table public.ghostwriter_public_rewrites from public;
grant select on table public.ghostwriter_public_rewrites to anon;
grant select on table public.ghostwriter_public_rewrites to authenticated;
