-- The Belek Cup 2026 — Postgres schema for Supabase.
--
-- Design goals:
--   * Public READ for everyone (players tap a name, no login).
--   * Score entry writable by anyone, but ONLY while a round is open (upcoming/scoring).
--   * Everything trust-critical (corrections, declaring, sealing, LOCKING, teams,
--     side prizes, announcements) is organiser-only, via Supabase Auth.
--
-- Run this in the Supabase SQL editor (or `supabase db push`). Then load seed.sql.
-- See docs/DATABASE.md for the data model and env vars.

-- ─────────────────────────────────────────────────────────────
-- Organiser identity
-- ─────────────────────────────────────────────────────────────
create table if not exists organisers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create or replace function is_organiser() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organisers o where o.user_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────
-- Static config
-- ─────────────────────────────────────────────────────────────
create table if not exists events (
  id text primary key,
  brand text not null,
  name text not null,
  location text,
  start_date date not null,
  end_date date not null,
  ceremony_date date,
  allowance numeric not null default 0.95,
  counting_rounds int not null default 2
);

create table if not exists courses (
  id text primary key,
  event_id text not null references events (id) on delete cascade,
  name text not null,
  par int not null,
  distance_unit text not null default 'm'
);

create table if not exists tees (
  course_id text not null references courses (id) on delete cascade,
  tee text not null,               -- yellow | red | gold ...
  gender char(1) not null,         -- M | F
  course_rating numeric not null,
  slope int not null,
  primary key (course_id, tee)
);

-- Par/SI are shared across tees; distance is per tee. Stored per (course, tee) for simplicity.
create table if not exists holes (
  course_id text not null references courses (id) on delete cascade,
  tee text not null,
  number int not null check (number between 1 and 18),
  par int not null,
  stroke_index int not null check (stroke_index between 1 and 18),
  distance int not null,
  primary key (course_id, tee, number)
);

create table if not exists players (
  id text primary key,
  event_id text not null references events (id) on delete cascade,
  name text not null,              -- display name, unique per event
  full_name text not null,
  gender char(1) not null,
  tee text not null,
  index numeric,                   -- null = non-competing attendee
  index_provisional boolean not null default false,
  competing boolean not null default true,
  organiser boolean not null default false,
  locked_group text,
  unique (event_id, name)
);

create table if not exists teams (
  id text primary key,
  event_id text not null references events (id) on delete cascade,
  name text not null
);

create table if not exists team_members (
  team_id text not null references teams (id) on delete cascade,
  player_id text not null references players (id) on delete cascade,
  primary key (team_id, player_id)
);

create table if not exists couples (
  event_id text not null references events (id) on delete cascade,
  player_a text not null references players (id) on delete cascade,
  player_b text not null references players (id) on delete cascade,
  primary key (player_a, player_b)
);

create table if not exists competitions (
  id text primary key,
  event_id text not null references events (id) on delete cascade,
  name text not null,
  type text not null,              -- individual-stableford | team-stableford | nearest-the-pin | longest-drive
  gender char(1),
  counting_rounds int
);

create table if not exists rounds (
  id text primary key,
  event_id text not null references events (id) on delete cascade,
  number int not null,
  course_id text not null references courses (id),
  date date not null,
  tee_window text,
  status text not null default 'upcoming',  -- upcoming|scoring|sealed|declared|locked
  sealed_until_ceremony boolean not null default false
);

create table if not exists tee_groups (
  id text primary key,
  round_id text not null references rounds (id) on delete cascade,
  name text not null,
  scorer_id text not null references players (id)
);

create table if not exists tee_group_members (
  group_id text not null references tee_groups (id) on delete cascade,
  player_id text not null references players (id) on delete cascade,
  primary key (group_id, player_id)
);

-- ─────────────────────────────────────────────────────────────
-- Scoring
-- ─────────────────────────────────────────────────────────────
create table if not exists scorecards (
  round_id text not null references rounds (id) on delete cascade,
  player_id text not null references players (id) on delete cascade,
  signed_by text references players (id),
  signed_at timestamptz,
  primary key (round_id, player_id)
);

create table if not exists hole_scores (
  round_id text not null,
  player_id text not null,
  hole int not null check (hole between 1 and 18),
  strokes int,                     -- null = not entered
  no_return boolean not null default false,  -- true = "X"
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id, hole),
  foreign key (round_id, player_id) references scorecards (round_id, player_id) on delete cascade
);

create table if not exists corrections (
  id bigint generated always as identity primary key,
  round_id text not null,
  player_id text not null,
  hole int not null,
  from_value text,
  to_value text,
  by_player text not null references players (id),
  at timestamptz not null default now()
);

create table if not exists side_prizes (
  round_id text not null references rounds (id) on delete cascade,
  competition_id text not null references competitions (id) on delete cascade,
  hole int,
  winner_id text references players (id),
  primary key (round_id, competition_id)
);

create table if not exists announcements (
  id bigint generated always as identity primary key,
  event_id text not null references events (id) on delete cascade,
  title text not null,
  body text,
  by_player text references players (id),
  at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'events','courses','tees','holes','players','teams','team_members','couples',
    'competitions','rounds','tee_groups','tee_group_members','scorecards','hole_scores',
    'corrections','side_prizes','announcements','organisers'
  ] loop
    execute format('alter table %I enable row level security;', t);
    -- Public read on everything.
    execute format($p$create policy %I on %I for select using (true);$p$, t||'_read', t);
    -- Organiser can do anything.
    execute format($p$create policy %I on %I for all using (is_organiser()) with check (is_organiser());$p$, t||'_org', t);
  end loop;
end $$;

-- Helper: is a round open for public score entry?
create or replace function round_open(rid text) returns boolean
language sql stable as $$
  select exists (select 1 from rounds r where r.id = rid and r.status in ('upcoming','scoring'));
$$;

-- Anyone (the nominated scorer, unauthenticated) may create/upsert scores while the round is open.
create policy scorecards_public_write on scorecards
  for insert with check (round_open(round_id));
create policy hole_scores_public_insert on hole_scores
  for insert with check (round_open(round_id));
create policy hole_scores_public_update on hole_scores
  for update using (round_open(round_id)) with check (round_open(round_id));
create policy scorecards_public_sign on scorecards
  for update using (round_open(round_id)) with check (round_open(round_id));

-- Realtime: publish the tables the app subscribes to (submission board, standings, ceremony).
alter publication supabase_realtime add table hole_scores, scorecards, rounds, side_prizes, announcements;
