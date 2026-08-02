# Database & data model

## Why Supabase

The handover's preference is sound. For 16 users, three rounds and one event, Supabase gives
exactly what's needed with nothing to run: **Postgres** (relational scoring data), **Auth**
(the two organisers), **Realtime** (the live "cards in" submission board and the ceremony
reveal) and **Storage** (kept for a future photo gallery). There is no clearly better fit at
this scale, so we did not challenge it.

## Single source of truth

Event data (courses, players, handicaps, rounds, competitions, the default draw) lives in
**`src/data/belek-cup-2026.ts`**, transcribed from the club-validated `data/courses.md`.
Everything else derives from it. `npm run db:seed` pushes that same data into Supabase, so the
database and the app can never disagree.

The scoring engine (`src/domain/scoring.ts`) reproduces the club's validated playing-handicap
table for all 14 players across all 3 courses — asserted in `scoring.test.ts`. If you change a
handicap, index, rating, slope or stroke index, the tests tell you immediately whether the
numbers still reconcile.

## Schema

`supabase/schema.sql` creates the tables (event, courses, tees, holes, players, teams,
team_members, couples, competitions, rounds, tee_groups, tee_group_members, scorecards,
hole_scores, corrections, side_prizes, announcements, organisers) with:

- **Public read** on everything (players tap a name — no login).
- **Public score writes only while a round is open** (`status in ('upcoming','scoring')`),
  enforced by the `round_open()` policy. Once a round is sealed/declared/**locked**, scores
  can no longer be written by the public — only organisers can touch them.
- **Organiser-only** for corrections, round status changes, locking, teams, side prizes and
  announcements, via Supabase Auth and the `is_organiser()` helper.
- A **realtime publication** on `hole_scores`, `scorecards`, `rounds`, `side_prizes`,
  `announcements` for live updates.

### Setup

```bash
# 1. In the Supabase SQL editor, run supabase/schema.sql
# 2. Add an organiser: after they sign up via Supabase Auth, insert their user_id:
#    insert into organisers (user_id, name) values ('<auth-uid>', 'Sarah');
# 3. Seed the event data:
cp .env.example .env.local          # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run db:seed
```

## Handicap & scoring rules (encoded in the engine)

- Course Handicap = `Index × (Slope ÷ 113) + (Course Rating − Par)`.
- Playing Handicap = `round(Course Handicap × 0.95)` — 95% allowance, everyone, no special cases.
- Shots on a hole fall by stroke index (two on the lowest SIs once the handicap exceeds 18, etc.).
- Stableford points = `max(0, par + 2 − net)`; an **X** (no return) or blank hole scores zero.
- Gross is honest or hidden: any X makes the total a floor ("84+"), never a fabricated number.
- Order of Merit and the Team Cup use **best 2 of 3** — each player's worst round is dropped.

## Adapter status — the main remaining backend task

The app currently runs on the **local adapter** in `src/store/store.tsx` (state in
`localStorage`). This makes dev, demos and single-device use work with no backend.

`src/store/store.tsx` is deliberately shaped as the seam: its `EventState` and action names
map 1:1 onto the tables above. **Going multi-phone** means implementing a Supabase-backed
version of the same context — reads via `supabase.from(...).select()`, writes via
`upsert`, and live updates via `supabase.channel(...)` on the realtime publication — selected
when `isSupabaseConfigured` is true (`src/lib/supabase.ts`). The screens and selectors do not
change. This is the top item in [LIMITATIONS.md](LIMITATIONS.md).
