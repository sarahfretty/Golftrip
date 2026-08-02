/*
 * Seed a Supabase project from the single source of truth (src/data/belek-cup-2026.ts).
 *
 * Usage:
 *   1. Run supabase/schema.sql in the Supabase SQL editor first.
 *   2. Put SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   3. npm run db:seed
 *
 * Uses the service-role key (server-side only) so it can write past RLS. Idempotent: it
 * upserts, so re-running is safe. It does NOT touch scores, corrections or announcements.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  EVENT, COURSES, PLAYERS, TEAMS, COUPLES, COMPETITIONS, ROUNDS, defaultTeeGroups,
} from "../src/data/belek-cup-2026";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function upsert(table: string, rows: object[], onConflict?: string) {
  if (rows.length === 0) return;
  const { error } = await db.from(table).upsert(rows, onConflict ? { onConflict } : undefined);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ✓ ${table} (${rows.length})`);
}

async function main() {
  console.log(`Seeding ${EVENT.name} → ${url}`);

  await upsert("events", [{
    id: EVENT.id, brand: EVENT.brand, name: EVENT.name, location: EVENT.location,
    start_date: EVENT.startDate, end_date: EVENT.endDate, ceremony_date: EVENT.ceremonyDate,
    allowance: EVENT.allowance, counting_rounds: EVENT.countingRounds,
  }]);

  await upsert("courses", COURSES.map((c) => ({
    id: c.id, event_id: EVENT.id, name: c.name, par: c.par, distance_unit: c.distanceUnit,
  })));

  await upsert("tees", COURSES.flatMap((c) => c.tees.map((t) => ({
    course_id: c.id, tee: t.tee, gender: t.gender, course_rating: t.courseRating, slope: t.slope,
  }))));

  await upsert("holes", COURSES.flatMap((c) => c.tees.flatMap((t) => t.holes.map((h) => ({
    course_id: c.id, tee: t.tee, number: h.number, par: h.par, stroke_index: h.strokeIndex, distance: h.distance,
  })))));

  await upsert("players", PLAYERS.map((p) => ({
    id: p.id, event_id: EVENT.id, name: p.name, full_name: p.fullName, gender: p.gender, tee: p.tee,
    index: p.index, index_provisional: p.indexProvisional ?? false, competing: p.competing,
    organiser: p.organiser ?? false, locked_group: p.lockedGroup ?? null,
  })));

  await upsert("teams", TEAMS.map((t) => ({ id: t.id, event_id: EVENT.id, name: t.name })));
  await upsert("team_members", TEAMS.flatMap((t) => t.playerIds.map((pid) => ({ team_id: t.id, player_id: pid }))));

  await upsert("couples", COUPLES.map((c) => ({ event_id: EVENT.id, player_a: c.playerIds[0], player_b: c.playerIds[1] })));

  await upsert("competitions", COMPETITIONS.map((c) => ({
    id: c.id, event_id: EVENT.id, name: c.name, type: c.type, gender: c.gender ?? null, counting_rounds: c.countingRounds ?? null,
  })));

  await upsert("rounds", ROUNDS.map((r) => ({
    id: r.id, event_id: EVENT.id, number: r.number, course_id: r.courseId, date: r.date,
    tee_window: r.teeWindow, status: r.status, sealed_until_ceremony: r.sealedUntilCeremony ?? false,
  })));

  const groups = defaultTeeGroups();
  await upsert("tee_groups", groups.map((g) => ({ id: g.id, round_id: g.roundId, name: g.name, scorer_id: g.scorerId })));
  await upsert("tee_group_members", groups.flatMap((g) => g.playerIds.map((pid) => ({ group_id: g.id, player_id: pid }))));

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
