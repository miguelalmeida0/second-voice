begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
alter function public.ghostwriter_penalty_window_seconds(integer) set search_path = pg_catalog;
commit;
