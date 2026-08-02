# Golf Trips — The Belek Cup 2026

A mobile-first, installable PWA for a golf trip: the countdown, the itinerary, the course
guides, post-round score entry and three trustworthy leaderboards, ending in a driven
ceremony reveal. Built for one event now (**The Belek Cup 2026**), structured so future
trips are new data, not a rewrite.

> **Governing principle:** the app enhances the golf, never interrupts it. No live scoring,
> no on-course phone use. One nominated scorer enters each group's card after the round;
> the app computes the points and publishes results the organiser has declared.
>
> **Second principle:** trust is the product. Every number answers who entered it, when,
> whether it's final, and who can still change it.

Production domain: **https://golftrips.app**

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript, Vite | Matches the design prototypes; a static SPA deploys to Cloudflare Pages with no server |
| Styling | CSS custom properties (design tokens) | The "Modernist" system as tokens; zero CSS framework dependency |
| Routing | react-router-dom | Client routing, four-tab shell |
| Scoring | Pure TS module, Vitest | The trust-critical core — unit-tested against the club's validated handicap table |
| Data (now) | Local/offline adapter (`localStorage`) | Runs with zero backend for dev, demos and single-device use |
| Data (shared) | Supabase (Postgres + Auth + Storage + Realtime) | The shared backend for multi-phone use — schema & client provided, wiring is the next task |
| PWA | vite-plugin-pwa (Workbox) | Installable, offline app shell, cached fonts |
| Hosting | Cloudflare Pages + DNS | Preview per branch/PR, production on the apex domain |

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

The app runs immediately on the **local adapter** — no database or keys required. Data lives
in your browser's `localStorage`. To reset, use the organiser console's "Reset all" button
(PIN `belek2026` in dev) or clear site data.

### Scripts

| Script | Does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the scoring-engine test suite (38 tests) |
| `npm run coverage` | Tests with coverage |
| `npm run lint` | oxlint |
| `npm run db:seed` | Seed a Supabase project from the source-of-truth data (needs env, see docs) |

## Project structure

```
src/
  domain/
    types.ts            Core domain types (event-agnostic)
    scoring.ts          The scoring engine — handicaps, Stableford, best-2-of-3, validation
    scoring.test.ts     38 tests, incl. the club-validated 14×3 handicap table
  data/
    belek-cup-2026.ts   Single source of truth for the event (courses, players, rounds…)
  store/
    store.tsx           React context: mutable state + derived leaderboards (local adapter)
  lib/
    supabase.ts         Supabase browser client (used when env vars are set)
    format.ts           Date/countdown helpers
  screens/              Home, Trip, Courses, Cup, ScoreEntry, Players, Admin
  components/           Shield (crest), TabBar
  styles/               tokens.css, global.css, app.css
supabase/
  schema.sql            Postgres schema + RLS + realtime publication
scripts/
  seed.ts               Seed Supabase from src/data (npm run db:seed)
public/                 Icons, manifest inputs, _headers, _redirects
docs/                   Deployment, domain, env, database, admin, limitations
data/courses.md         The club-validated source document (reference)
```

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GitHub repo + Cloudflare Pages (preview → production)
- [docs/DOMAIN.md](docs/DOMAIN.md) — golftrips.app custom domain, www redirect, HTTPS
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) — environment variables
- [docs/DATABASE.md](docs/DATABASE.md) — data model, schema, RLS, seeding, adapter status
- [docs/ADMIN.md](docs/ADMIN.md) — organiser usage (entry, corrections, declaring, locking)
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) — known limitations & what's deliberately out of scope

## Deployment in one line

Local → GitHub → Cloudflare Pages (preview per branch/PR) → production at **golftrips.app**.
Nothing touches the live domain until a Cloudflare preview has been fully tested. Full steps
in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
