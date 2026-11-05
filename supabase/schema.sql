create table public.scores (
  id bigint generated always as identity primary key,
  user_id text not null,              -- Clerk user id (JWT "sub")
  name text not null,
  score int not null,
  lines int not null,
  level int not null,
  pieces int not null,
  seconds int not null,
  clears int[] not null default '{0,0,0,0}',
  created_at timestamptz not null default now()
);
create index on public.scores (user_id, score desc);

alter table public.scores enable row level security;
-- Players can read only their own rows. Inserts happen via the edge function (service role).
create policy "read own scores" on public.scores
  for select using ((auth.jwt() ->> 'sub') = user_id);
