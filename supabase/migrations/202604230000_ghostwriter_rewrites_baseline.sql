create table if not exists public.ghostwriter_rewrites (
  id uuid primary key default gen_random_uuid(),
  short_id text not null,
  author text not null,
  mood integer not null,
  input_text text not null default '',
  output_text text not null,
  created_at timestamptz not null default now()
);
