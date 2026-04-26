create table if not exists public.ghostwriter_public_rewrite_allowlist (
  short_id text primary key,
  allowlisted_at timestamptz not null default now(),
  reason text not null default 'pre-existing public share consent',
  constraint ghostwriter_public_rewrite_allowlist_short_id_check
    check (short_id ~ '^[a-z2-9]{8}$')
);

comment on table public.ghostwriter_public_rewrite_allowlist is
  'Service-role-only emergency allowlist for rewrite rows that had explicit public-share consent before the privacy correction. Empty by default means legacy rows become private.';

alter table public.ghostwriter_public_rewrite_allowlist enable row level security;
revoke all on table public.ghostwriter_public_rewrite_allowlist from public;
revoke all on table public.ghostwriter_public_rewrite_allowlist from anon;
revoke all on table public.ghostwriter_public_rewrite_allowlist from authenticated;
grant all on table public.ghostwriter_public_rewrite_allowlist to service_role;

alter table if exists public.ghostwriter_rewrites
  alter column is_public set default false,
  alter column source_visible set default false;

with allowlisted as (
  select
    rewrites.id,
    allowlist.short_id is not null as should_be_public
  from public.ghostwriter_rewrites as rewrites
  left join public.ghostwriter_public_rewrite_allowlist as allowlist
    on allowlist.short_id = rewrites.short_id
)
update public.ghostwriter_rewrites as rewrites
set
  is_public = allowlisted.should_be_public,
  source_visible = false
from allowlisted
where
  rewrites.id = allowlisted.id
  and (
    rewrites.is_public is distinct from allowlisted.should_be_public
    or rewrites.source_visible is distinct from false
  );

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
  'Public Ghostwriter artifacts with source text masked unless explicitly allowed.';

revoke all on table public.ghostwriter_public_rewrites from public;
grant select on table public.ghostwriter_public_rewrites to anon;
grant select on table public.ghostwriter_public_rewrites to authenticated;
