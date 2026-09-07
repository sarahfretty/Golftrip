-- Lets the Console delete an announcement.
--
-- Part of the same temporary arrangement as temp-organiser-policies.sql: the Console is
-- gated by a PIN that Postgres knows nothing about, so it reaches the database anonymously.
-- Without this, the Delete button appears to work and silently changes nothing — a blocked
-- DELETE returns no error, it just removes no rows.
--
-- Announcements are the only thing the public key may delete. Scores, cards and corrections
-- stay undeletable: the audit trail is append-only by design.
--
-- Remove this along with temp-organiser-policies.sql once Supabase Auth is in place.

drop policy if exists announcements_public_delete on announcements;
create policy announcements_public_delete on announcements for delete using (true);

notify pgrst, 'reload schema';
