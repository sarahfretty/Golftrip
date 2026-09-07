/*
 * Supabase persistence for the event state.
 *
 * The app's state shape does not change: this module reads the Postgres tables in
 * supabase/schema.sql into exactly the `EventState` the local adapter builds, and writes
 * each action back. `store.tsx` picks this when Supabase is configured and falls back to
 * localStorage when it isn't, so the screens and selectors never learn which is in use.
 *
 * Reads are a full refetch rather than incremental patching. The event is small — fifteen
 * players over three rounds — and a refetch cannot drift from the database, which matters
 * more than saving a few hundred bytes on a golf course.
 */
import { supabase } from "../lib/supabase";
import { EVENT } from "../data/belek-cup-2026";
import type {
  Announcement,
  Correction,
  HoleScore,
  Round,
  RoundStatus,
  Scorecard,
  SidePrize,
  Team,
  TeeGroup,
} from "../domain/types";
import type { EventState } from "./store";

function client() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

const cardKey = (roundId: string, playerId: string) => `${roundId}:${playerId}`;

/** A hole's value is stored as strokes + a no-return flag; the app works in one union. */
const toStrokes = (v: HoleScore) => (typeof v === "number" ? v : null);
const toNoReturn = (v: HoleScore) => v === "X";
const asText = (v: HoleScore) => (v === null ? null : String(v));
const fromText = (t: string | null): HoleScore => (t === null ? null : t === "X" ? "X" : Number(t));

type HoleRow = { round_id: string; player_id: string; hole: number; strokes: number | null; no_return: boolean };

// ── Read ─────────────────────────────────────────────────────────────────────

export async function fetchState(): Promise<EventState> {
  const db = client();
  const [ev, rounds, teams, teamMembers, groups, groupMembers, cards, scores, corrections, prizes, anns] =
    await Promise.all([
      db.from("events").select("teams_revealed").eq("id", EVENT.id).single(),
      db.from("rounds").select("*").order("number"),
      db.from("teams").select("*").order("id"),
      db.from("team_members").select("*"),
      db.from("tee_groups").select("*").order("id"),
      db.from("tee_group_members").select("*"),
      db.from("scorecards").select("*"),
      db.from("hole_scores").select("*"),
      db.from("corrections").select("*").order("at"),
      db.from("side_prizes").select("*"),
      db.from("announcements").select("*").order("at", { ascending: false }),
    ]);

  const failed = [ev, rounds, teams, teamMembers, groups, groupMembers, cards, scores, corrections, prizes, anns]
    .find((r) => r.error);
  if (failed?.error) throw new Error(`Supabase read failed: ${failed.error.message}`);

  const scoreRows = (scores.data ?? []) as HoleRow[];
  const correctionRows = (corrections.data ?? []) as {
    round_id: string; player_id: string; hole: number;
    from_value: string | null; to_value: string | null; by_player: string; at: string;
  }[];

  const scorecards: Record<string, Scorecard> = {};
  for (const c of (cards.data ?? []) as { round_id: string; player_id: string; signed_by: string | null; signed_at: string | null }[]) {
    const k = cardKey(c.round_id, c.player_id);
    const strokes: HoleScore[] = Array(18).fill(null);
    for (const s of scoreRows.filter((s) => s.round_id === c.round_id && s.player_id === c.player_id)) {
      strokes[s.hole - 1] = s.no_return ? "X" : s.strokes;
    }
    const mine: Correction[] = correctionRows
      .filter((x) => x.round_id === c.round_id && x.player_id === c.player_id)
      .map((x) => ({ hole: x.hole, from: fromText(x.from_value), to: fromText(x.to_value), by: x.by_player, at: x.at }));
    scorecards[k] = {
      id: k,
      roundId: c.round_id,
      playerId: c.player_id,
      strokes,
      ...(c.signed_by ? { signedBy: c.signed_by } : {}),
      ...(c.signed_at ? { signedAt: c.signed_at } : {}),
      ...(mine.length ? { corrections: mine } : {}),
    };
  }

  const members = (teamMembers.data ?? []) as { team_id: string; player_id: string; scoring: boolean }[];
  const groupMembersRows = (groupMembers.data ?? []) as { group_id: string; player_id: string }[];

  return {
    rounds: ((rounds.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      number: r.number as number,
      courseId: r.course_id as string,
      date: r.date as string,
      teeWindow: (r.tee_window ?? "") as string,
      status: r.status as RoundStatus,
      ...(r.sealed_until_ceremony ? { sealedUntilCeremony: true } : {}),
    })) as Round[],
    teams: ((teams.data ?? []) as { id: string; name: string; captain_id: string | null }[]).map((t) => ({
      id: t.id,
      name: t.name,
      captainId: t.captain_id,
      playerIds: members.filter((m) => m.team_id === t.id && m.scoring).map((m) => m.player_id),
      nonScoringIds: members.filter((m) => m.team_id === t.id && !m.scoring).map((m) => m.player_id),
    })) as Team[],
    teamsRevealed: Boolean((ev.data as { teams_revealed: boolean } | null)?.teams_revealed),
    // The signature only guards the localStorage copy; with Supabase there is one copy.
    teamsSignature: "",
    teeGroups: ((groups.data ?? []) as { id: string; round_id: string; name: string; scorer_id: string }[]).map((g) => ({
      id: g.id,
      roundId: g.round_id,
      name: g.name,
      scorerId: g.scorer_id,
      playerIds: groupMembersRows.filter((m) => m.group_id === g.id).map((m) => m.player_id),
    })) as TeeGroup[],
    scorecards,
    sidePrizes: ((prizes.data ?? []) as { round_id: string; competition_id: string; hole: number | null; winner_id: string | null }[])
      .map((p) => ({ roundId: p.round_id, competitionId: p.competition_id, hole: p.hole ?? 0, winnerId: p.winner_id })) as SidePrize[],
    announcements: ((anns.data ?? []) as { id: number; title: string; body: string | null; by_player: string | null; at: string }[])
      .map((a) => ({ id: String(a.id), title: a.title, body: a.body ?? "", by: a.by_player ?? "", at: a.at })) as Announcement[],
  };
}

// ── Write ────────────────────────────────────────────────────────────────────
//
// Every write returns a promise the caller can await or ignore. store.tsx updates local
// state optimistically and refetches on realtime events, so a failure surfaces as the
// change reverting rather than as silently divergent state.

/** A hole score needs its parent scorecard row to exist first (hole_scores references it). */
async function ensureCard(roundId: string, playerId: string) {
  const { error } = await client()
    .from("scorecards")
    .upsert({ round_id: roundId, player_id: playerId }, { onConflict: "round_id,player_id", ignoreDuplicates: true });
  if (error) throw new Error(`scorecards: ${error.message}`);
}

export async function setStroke(roundId: string, playerId: string, hole: number, value: HoleScore) {
  await ensureCard(roundId, playerId);
  const { error } = await client().from("hole_scores").upsert(
    {
      round_id: roundId,
      player_id: playerId,
      hole,
      strokes: toStrokes(value),
      no_return: toNoReturn(value),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "round_id,player_id,hole" },
  );
  if (error) throw new Error(`hole_scores: ${error.message}`);
}

export async function signCard(roundId: string, playerId: string, by: string) {
  await ensureCard(roundId, playerId);
  const { error } = await client()
    .from("scorecards")
    .update({ signed_by: by, signed_at: new Date().toISOString() })
    .eq("round_id", roundId)
    .eq("player_id", playerId);
  if (error) throw new Error(`scorecards sign: ${error.message}`);
}

export async function correctStroke(
  roundId: string, playerId: string, hole: number, value: HoleScore, by: string, from: HoleScore,
) {
  await setStroke(roundId, playerId, hole, value);
  const { error } = await client().from("corrections").insert({
    round_id: roundId, player_id: playerId, hole,
    from_value: asText(from), to_value: asText(value), by_player: by,
  });
  if (error) throw new Error(`corrections: ${error.message}`);
}

export async function setRoundStatus(roundId: string, status: RoundStatus) {
  const { error } = await client().from("rounds").update({ status }).eq("id", roundId);
  if (error) throw new Error(`rounds: ${error.message}`);
}

export async function setSidePrize(roundId: string, competitionId: string, hole: number, winnerId: string | null) {
  const { error } = await client().from("side_prizes").upsert(
    { round_id: roundId, competition_id: competitionId, hole, winner_id: winnerId },
    { onConflict: "round_id,competition_id" },
  );
  if (error) throw new Error(`side_prizes: ${error.message}`);
}

export async function setGroupScorer(groupId: string, playerId: string) {
  const { error } = await client().from("tee_groups").update({ scorer_id: playerId }).eq("id", groupId);
  if (error) throw new Error(`tee_groups: ${error.message}`);
}

export async function setTeams(teams: Team[]) {
  const db = client();
  for (const t of teams) {
    const { error: e1 } = await db.from("teams").update({ captain_id: t.captainId }).eq("id", t.id);
    if (e1) throw new Error(`teams: ${e1.message}`);
    const { error: e2 } = await db.from("team_members").delete().eq("team_id", t.id);
    if (e2) throw new Error(`team_members clear: ${e2.message}`);
    const rows = [
      ...t.playerIds.map((pid) => ({ team_id: t.id, player_id: pid, scoring: true })),
      ...t.nonScoringIds.map((pid) => ({ team_id: t.id, player_id: pid, scoring: false })),
    ];
    if (rows.length) {
      const { error: e3 } = await db.from("team_members").insert(rows);
      if (e3) throw new Error(`team_members: ${e3.message}`);
    }
  }
}

export async function setTeamsRevealed(revealed: boolean) {
  const { error } = await client().from("events").update({ teams_revealed: revealed }).eq("id", EVENT.id);
  if (error) throw new Error(`events: ${error.message}`);
}

export async function addAnnouncement(title: string, body: string, by: string) {
  const { error } = await client()
    .from("announcements")
    .insert({ event_id: EVENT.id, title, body, by_player: by });
  if (error) throw new Error(`announcements: ${error.message}`);
}

export async function removeAnnouncement(id: string) {
  const { error } = await client().from("announcements").delete().eq("id", Number(id));
  if (error) throw new Error(`announcements delete: ${error.message}`);
}

// ── Realtime ─────────────────────────────────────────────────────────────────

/**
 * Call `onChange` whenever anything the app displays changes in the database. Coalesced,
 * because a scorer tapping through a hole produces several rows in quick succession and
 * the response is a single refetch either way.
 */
export function subscribe(onChange: () => void): () => void {
  const db = client();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ping = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 250);
  };

  const channel = db.channel("belek-cup");
  for (const table of [
    "hole_scores", "scorecards", "rounds", "side_prizes", "announcements", "events", "teams", "team_members",
  ]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, ping);
  }
  channel.subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    void db.removeChannel(channel);
  };
}
