-- Server-owned DAEMON exercise. The client never writes this row.
create table if not exists daemon_exercise (
  id text primary key,
  world text not null,
  updated_at timestamptz not null default current_timestamp
);
