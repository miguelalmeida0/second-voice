alter table if exists public.ghostwriter_rewrites
  alter column short_id set not null,
  alter column author set not null,
  alter column mood set not null,
  alter column input_text set not null,
  alter column output_text set not null,
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_short_id_format'
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_short_id_format
      check (short_id ~ '^[abcdefghijkmnopqrstuvwxyz23456789]{8}$');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ghostwriter_rewrites_mood_range'
  ) then
    alter table public.ghostwriter_rewrites
      add constraint ghostwriter_rewrites_mood_range
      check (mood between 0 and 100);
  end if;
end $$;

create unique index if not exists ghostwriter_rewrites_short_id_key
  on public.ghostwriter_rewrites (short_id);

alter table if exists public.ghostwriter_rewrites enable row level security;

revoke all on table public.ghostwriter_rewrites from anon;
revoke all on table public.ghostwriter_rewrites from authenticated;
