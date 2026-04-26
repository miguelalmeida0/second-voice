alter table if exists public.ghostwriter_rewrites
  add column if not exists is_public boolean not null default false,
  add column if not exists source_visible boolean not null default false;

alter table if exists public.ghostwriter_rewrites
  alter column is_public set default false,
  alter column source_visible set default false;

comment on column public.ghostwriter_rewrites.is_public is
  'Only rows marked public are exposed through the public view.';

comment on column public.ghostwriter_rewrites.source_visible is
  'When false, public readers receive a blank input_text even if legacy rows once stored source text.';

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
  source_visible
from public.ghostwriter_rewrites
where is_public = true;

comment on view public.ghostwriter_public_rewrites is
  'Public Ghostwriter artifacts with source text masked unless explicitly allowed.';

revoke all on table public.ghostwriter_public_rewrites from public;
grant select on table public.ghostwriter_public_rewrites to anon;
grant select on table public.ghostwriter_public_rewrites to authenticated;
