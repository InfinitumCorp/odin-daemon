-- ODIN° DAEMON — server-owned exercise picture.
--
-- Lives in its own schema in the shared "Infinitum Corp" Supabase project
-- (one schema per product). The browser never reads or writes this table: the
-- Worker talks to Postgres over DATABASE_URL, and row-level security is on
-- with no policies, so the Data API (anon / authenticated keys) gets nothing.
--
-- Safe to run more than once (Supabase CLI and the local PGLite preview both
-- apply this file).

create schema if not exists odin_daemon;

create table if not exists odin_daemon.daemon_exercise (
  id text primary key,
  world text not null,
  updated_at timestamptz not null default current_timestamp
);

alter table odin_daemon.daemon_exercise enable row level security;

-- Supabase roles only exist on Supabase, not in the PGLite preview.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema odin_daemon from anon, authenticated;
    revoke all on all tables in schema odin_daemon from anon, authenticated;
  end if;
end
$$;
