-- ─────────────────────────────────────────────────────────────
-- TEMPORARY: organiser actions without Supabase Auth
-- ─────────────────────────────────────────────────────────────
-- Run this AFTER schema.sql. Safe to re-run.
--
-- The Console is gated by a shared PIN that Postgres knows nothing about, so an organiser
-- reaches the database as an anonymous caller and every action below is refused by the
-- is_organiser() policies in schema.sql. Rather than block the trip on building auth,
-- these policies let the public key perform exactly the verbs the Console needs.
--
-- The trade-off, stated plainly: anyone holding the public key — it ships inside the
-- JavaScript every phone downloads — could call these directly. That is fifteen friends,
-- and the organiser PIN was already readable in the same bundle, so this is barely weaker
-- than the app was before Supabase. It IS weaker than schema.sql intends.
--
-- AFTER THE TRIP: implement Supabase Auth for the two organisers, then run
-- undo-temp-organiser-policies.sql to drop everything below.
--
-- Deliberately NOT granted, even temporarily:
--   * deleting rounds, players, scorecards, scores or announcements
--   * updating or deleting corrections — the audit trail stays append-only
--   * any write to courses, tees, holes, players or competitions

drop policy if exists rounds_public_status on rounds;
create policy rounds_public_status on rounds for update using (true) with check (true);

drop policy if exists events_public_update on events;
create policy events_public_update on events for update using (true) with check (true);

drop policy if exists teams_public_update on teams;
create policy teams_public_update on teams for update using (true) with check (true);

drop policy if exists team_members_public_insert on team_members;
create policy team_members_public_insert on team_members for insert with check (true);

drop policy if exists team_members_public_delete on team_members;
create policy team_members_public_delete on team_members for delete using (true);

drop policy if exists tee_groups_public_update on tee_groups;
create policy tee_groups_public_update on tee_groups for update using (true) with check (true);

drop policy if exists side_prizes_public_insert on side_prizes;
create policy side_prizes_public_insert on side_prizes for insert with check (true);

drop policy if exists side_prizes_public_update on side_prizes;
create policy side_prizes_public_update on side_prizes for update using (true) with check (true);

drop policy if exists corrections_public_insert on corrections;
create policy corrections_public_insert on corrections for insert with check (true);

drop policy if exists announcements_public_insert on announcements;
create policy announcements_public_insert on announcements for insert with check (true);

notify pgrst, 'reload schema';
