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
import dotenv from "dotenv";
// The documented home for these values is .env.local (gitignored); fall back to .env.
// dotenv does not overwrite what is already set, so .env.local wins.
dotenv.config({ path: ".env.local" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import {
  EVENT, COURSES, PLAYERS, TEAMS, TEAMS_REVEALED, COUPLES, COMPETITIONS, ROUNDS, defaultTeeGroups,
} from "../src/data/belek-cup-2026";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/**
 * Membership tables are a full replacement, not an upsert.
 *
 * Upserting only ever adds: when the draw changes, the rows for the old draw stay behind and
 * groups quietly accumulate players. Re-seeding after three draw changes left groups holding
 * seven and eight golfers. These tables describe the current draw, so the current draw is
 * exactly what they should contain.
 */
async function replaceAll(table: string, keyColumn: string, rows: object[]) {
  const { error: delError } = await db.from(table).delete().not(keyColumn, "is", null);
  if (delError) throw new Error(`${table} clear: ${delError.message}`);
  if (rows.length === 0) return;
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ✓ ${table} (${rows.length}, replaced)`);
}

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
    teams_revealed: TEAMS_REVEALED,
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

  await upsert("teams", TEAMS.map((t) => ({
    id: t.id, event_id: EVENT.id, name: t.name, captain_id: t.captainId ?? null,
  })));
  // Both rosters go in: scoring members and the ones on the team whose card never counts.
  await replaceAll("team_members", "team_id", TEAMS.flatMap((t) => [
    ...t.playerIds.map((pid) => ({ team_id: t.id, player_id: pid, scoring: true })),
    ...t.nonScoringIds.map((pid) => ({ team_id: t.id, player_id: pid, scoring: false })),
  ]));

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
  await replaceAll("tee_group_members", "group_id",
    groups.flatMap((g) => g.playerIds.map((pid) => ({ group_id: g.id, player_id: pid }))));

  // Read back what actually landed. An upsert that should have been a replacement left
  // groups holding seven and eight golfers once already; counting is cheap insurance.
  const expected: Record<string, number> = {
    players: PLAYERS.length,
    teams: TEAMS.length,
    team_members: TEAMS.reduce((n, t) => n + t.playerIds.length + t.nonScoringIds.length, 0),
    rounds: ROUNDS.length,
    tee_groups: groups.length,
    tee_group_members: groups.reduce((n, g) => n + g.playerIds.length, 0),
  };
  const wrong: string[] = [];
  for (const [table, want] of Object.entries(expected)) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table} verify: ${error.message}`);
    if (count !== want) wrong.push(`${table}: found ${count}, expected ${want}`);
  }
  if (wrong.length) {
    console.error("\nSeed finished but the database does not match the source data:");
    for (const w of wrong) console.error("  ✗ " + w);
    process.exit(1);
  }
  console.log("Verified: every table matches src/data/belek-cup-2026.ts");

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
