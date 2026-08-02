# Known limitations & scope

Honest status of the build. The core — the tested scoring engine and the whole app flow on
the local adapter — is complete and works. The items below are deliberately deferred or out
of scope for v1.

## The main remaining engineering task

1. **Supabase data adapter.** The app runs on the local/offline adapter (`localStorage`), so
   every phone currently has its own copy of the data. A shared, multi-phone leaderboard needs
   the store (`src/store/store.tsx`) wired to Supabase — the schema, client, RLS, realtime
   publication and seed script are all in place; the store is shaped as the seam. This is the
   one thing to finish before the trip if more than one device enters scores. See
   [DATABASE.md](DATABASE.md) → "Adapter status".

2. **Organiser auth.** Access to the Console is a shared PIN in the local adapter. Production
   should use **Supabase Auth** (the `organisers` table + `is_organiser()` already exist); the
   Supabase sign-in UI is not yet built.

## Deferred features (scoped but not built)

3. **Ceremony Mode.** The final round seals and the Cup tab shows declared standings, but the
   theatrical one-tap-at-a-time reveal screen isn't built yet.
4. **AI round reports.** Three organiser-approved round reports are scoped. Not implemented —
   for now the Announcements feature can carry a manually written report. Generation +
   approval flow is a follow-up.
5. **Group draw generation.** Tee groups are seeded with the ladies' fourball locked, and the
   scorer is editable, but automatic per-round reshuffling ("maximise new pairings") and a full
   group-membership editor are not built.

## Design trade-offs to be aware of

6. **Score entry caps at "8+".** The button grid is 2–7 plus "8+" (stored as 8) and X, matching
   the prototype. Exact gross above 8 (or a hole-in-one recorded as 1) is entered via an
   organiser **correction**. Stableford points are unaffected in almost all cases (net double
   bogey or worse scores zero regardless).
7. **Fonts load from Google Fonts** (cached by the service worker after first load). Self-hosting
   Archivo + Bodoni Moda would remove the external dependency and the first-load font swap.
8. **Photos** are deliberately out (Product Definition cut it as a WhatsApp duplicate). The
   schema keeps room for a future gallery via Supabase Storage.

## Testing & tooling

9. **Engine is unit-tested (38 tests); the UI is not yet covered by automated E2E tests.** A
   Playwright smoke test of the score-entry → declare → leaderboard path would be a good add.
10. **Node version:** Vite 8 wants Node 20.19+ or 22.12+. `.nvmrc` pins `20.19.0` for CI; a
    local 22.11 install only prints a warning.

## Explicitly out of scope for v1 (by design)

Player accounts/passwords, flights/rooms personalisation, daily bulletins (three round reports
instead), multi-tenant admin, live/on-course scoring, player-claimed side prizes. See the
Product Definition for the reasoning behind each cut.
