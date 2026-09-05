-- Undo temp-organiser-policies.sql.
--
-- Run this once Supabase Auth is in place for the two organisers, so that organiser
-- actions are governed by is_organiser() again as schema.sql intends. Scoring is
-- unaffected: the public score-entry policies live in schema.sql, not here.

drop policy if exists rounds_public_status on rounds;
drop policy if exists events_public_update on events;
drop policy if exists teams_public_update on teams;
drop policy if exists team_members_public_insert on team_members;
drop policy if exists team_members_public_delete on team_members;
drop policy if exists tee_groups_public_update on tee_groups;
drop policy if exists side_prizes_public_insert on side_prizes;
drop policy if exists side_prizes_public_update on side_prizes;
drop policy if exists corrections_public_insert on corrections;
drop policy if exists announcements_public_insert on announcements;

notify pgrst, 'reload schema';
