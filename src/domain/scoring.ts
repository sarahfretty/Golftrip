// The scoring engine.
//
// Trust is the product: this module is pure, typed and unit-tested, and it is the
// only place Stableford/handicap arithmetic happens. Nobody using the app ever does
// this maths — the scorer taps gross strokes and everything below is derived.

import type {
  Hole,
  HoleScore,
  Scorecard,
  TeeSet,
} from "./types";

export const DEFAULT_ALLOWANCE = 0.95;

/** Par of a tee = sum of its holes' pars. Used in the Course Handicap formula, since a
 *  course can have different pars per tee (e.g. Wheatley: men 71, ladies 74). */
export function teePar(tee: { holes: Hole[] }): number {
  return tee.holes.reduce((sum, h) => sum + h.par, 0);
}

/**
 * Course Handicap = Index × (Slope ÷ 113) + (Course Rating − Par).
 * Unrounded — the allowance is applied before rounding.
 */
export function courseHandicap(
  index: number,
  tee: Pick<TeeSet, "slope" | "courseRating">,
  coursePar: number,
): number {
  return index * (tee.slope / 113) + (tee.courseRating - coursePar);
}

/**
 * Playing Handicap = round(Course Handicap × allowance).
 * 95% allowance for Belek, applied to everyone — one formula, no special cases.
 */
export function playingHandicap(
  index: number,
  tee: Pick<TeeSet, "slope" | "courseRating">,
  coursePar: number,
  allowance: number = DEFAULT_ALLOWANCE,
): number {
  return Math.round(courseHandicap(index, tee, coursePar) * allowance);
}

/**
 * Shots received on a single hole, straight off the stroke index.
 * A playing handicap of 20 gives two shots on SI 1–2, one on SI 3–18.
 * Handles handicaps above 18 (extra shots stack) and plus-handicaps (shots given back).
 */
export function shotsOnHole(ph: number, strokeIndex: number): number {
  if (ph >= 0) {
    const base = Math.floor(ph / 18);
    const remainder = ph - base * 18;
    return base + (strokeIndex <= remainder ? 1 : 0);
  }
  // Plus-handicap: give shots back from the easiest holes (SI 18 first).
  const magnitude = -ph;
  const base = Math.floor(magnitude / 18);
  const remainder = magnitude - base * 18;
  const give = base + (strokeIndex > 18 - remainder ? 1 : 0);
  return give === 0 ? 0 : -give; // avoid -0
}

/** Per-hole shots received for a whole card, keyed by hole number (1–18). */
export function shotsMap(ph: number, holes: Hole[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const h of holes) map[h.number] = shotsOnHole(ph, h.strokeIndex);
  return map;
}

/**
 * Stableford points for one hole. "X" (no return) and un-entered holes score zero.
 * points = max(0, par + 2 − net), where net = gross − shots received.
 */
export function holePoints(
  stroke: HoleScore,
  par: number,
  shotsReceived: number,
): number {
  if (stroke === "X" || stroke === null) return 0;
  const net = stroke - shotsReceived;
  return Math.max(0, par + 2 - net);
}

/** Total Stableford points for a card. */
export function cardPoints(
  card: Pick<Scorecard, "strokes">,
  holes: Hole[],
  ph: number,
): number {
  return holes.reduce((sum, h) => {
    const stroke = card.strokes[h.number - 1] ?? null;
    return sum + holePoints(stroke, h.par, shotsOnHole(ph, h.strokeIndex));
  }, 0);
}

export interface GrossTotal {
  /** Sum of numeric strokes entered. */
  total: number;
  /** True when the card contains any X or blank — the total is a floor, not a real gross. */
  isFloor: boolean;
  /** Number of holes with a numeric stroke entered. */
  entered: number;
}

/**
 * Gross total for the audit trail. Honest or not shown: a card with any X has no true
 * gross, so it is reported as a floor ("84+") and never a fabricated total.
 */
export function cardGross(card: Pick<Scorecard, "strokes">): GrossTotal {
  let total = 0;
  let entered = 0;
  let isFloor = false;
  for (const s of card.strokes) {
    if (typeof s === "number") {
      total += s;
      entered += 1;
    } else if (s === "X") {
      isFloor = true;
    } else {
      // blank hole — an incomplete card has no true gross either
      isFloor = true;
    }
  }
  return { total, isFloor, entered };
}

/** Format a gross total for display: "84" when honest, "84+" when a floor. */
export function formatGross(g: GrossTotal): string {
  return g.isFloor ? `${g.total}+` : `${g.total}`;
}

/** How many of the 18 holes have been entered (numeric or X). */
export function holesEntered(card: Pick<Scorecard, "strokes">): number {
  return card.strokes.filter((s) => s !== null && s !== undefined).length;
}

export function isCardComplete(card: Pick<Scorecard, "strokes">): boolean {
  return holesEntered(card) === 18;
}

/**
 * Best N of a set of round totals. Missing/zero rounds sort to the bottom and are
 * dropped naturally — a no-return round needs no ruling on the night.
 */
export function bestNTotal(roundTotals: number[], n: number): number {
  return [...roundTotals]
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((sum, v) => sum + v, 0);
}

export interface StandingRow {
  playerId: string;
  /** Points per round, in round order (0 for a missing/no-return round). */
  roundTotals: number[];
  /** Best-N total that decides the Order of Merit. */
  total: number;
}

/**
 * Order of Merit for a field: best-N total per player, sorted high to low.
 * `roundTotalsByPlayer` maps playerId -> per-round point totals in round order.
 */
export function orderOfMerit(
  roundTotalsByPlayer: Record<string, number[]>,
  countingRounds: number,
): StandingRow[] {
  return Object.entries(roundTotalsByPlayer)
    .map(([playerId, roundTotals]) => ({
      playerId,
      roundTotals,
      total: bestNTotal(roundTotals, countingRounds),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface TeamStandingRow {
  teamId: string;
  total: number;
  /** This team's score for every round, in the order the totals were supplied. */
  roundScores: number[];
  /** Points each member actually contributed — cards that counted, in rounds that counted. */
  contributions: { playerId: string; total: number }[];
}

/** How many cards count for a team in a single round. */
export const CARDS_PER_ROUND = 5;

/**
 * Team Cup. Two selections happen, in this order:
 *
 *   1. Within a round, only the team's best `cardsPerRound` cards count — a blow-up
 *      round or a no return is the card the team drops, so one bad day costs it nothing.
 *   2. Across the event, only the team's best `countingRounds` round scores count.
 *
 * Selecting cards per round (rather than summing every member) is what keeps teams of
 * different sizes comparable: each side contributes the same number of cards whatever
 * its headcount. Every member is a candidate every round; nobody is nominated in advance.
 */
export function teamStandings(
  teams: { id: string; playerIds: string[] }[],
  roundTotalsByPlayer: Record<string, number[]>,
  countingRounds: number,
  cardsPerRound: number = CARDS_PER_ROUND,
): TeamStandingRow[] {
  const roundCount = Math.max(
    0,
    ...teams.flatMap((t) => t.playerIds.map((pid) => roundTotalsByPlayer[pid]?.length ?? 0)),
  );

  return teams
    .map((team) => {
      // Round by round, take the best cards on the team.
      const perRound = Array.from({ length: roundCount }, (_, i) => {
        const counted = team.playerIds
          .map((playerId) => ({ playerId, points: roundTotalsByPlayer[playerId]?.[i] ?? 0 }))
          .sort((a, b) => b.points - a.points)
          .slice(0, cardsPerRound);
        return { score: counted.reduce((sum, c) => sum + c.points, 0), counted };
      });

      // Then keep only the team's best rounds.
      const countingRoundIdx = perRound
        .map((r, i) => ({ i, score: r.score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, countingRounds)
        .map((r) => r.i);

      const tally = new Map<string, number>();
      for (const i of countingRoundIdx) {
        for (const c of perRound[i].counted) {
          tally.set(c.playerId, (tally.get(c.playerId) ?? 0) + c.points);
        }
      }

      return {
        teamId: team.id,
        total: countingRoundIdx.reduce((sum, i) => sum + perRound[i].score, 0),
        roundScores: perRound.map((r) => r.score),
        contributions: team.playerIds.map((playerId) => ({
          playerId,
          total: tally.get(playerId) ?? 0,
        })),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * A fingerprint of the seeded teams.
 *
 * Each device persists its own copy of the teams on first load, so a merge that let the
 * saved copy win would pin whatever line-up was current the first time that phone opened
 * the app — a later deploy moving someone between teams would never reach them. Storing
 * this alongside the saved teams lets the app notice its copy is stale and take the seed.
 * Derived from the content rather than a hand-bumped number, so it cannot be forgotten.
 */
export function teamsSignature(
  teams: { id: string; captainId?: string | null; playerIds: string[]; nonScoringIds?: string[] }[],
): string {
  return teams
    .map((t) => [t.id, t.captainId ?? "", t.playerIds.join(","), (t.nonScoringIds ?? []).join(",")].join(":"))
    .join("|");
}

/** How long an announcement stays on Home before it becomes history on the Trip tab. */
export const ANNOUNCEMENT_HOURS_ON_HOME = 72;

/**
 * The announcements worth putting in front of someone on Home.
 *
 * Home answers "what is happening now", so it carries only what is still current, newest
 * first and capped. The Trip tab keeps the full record — nothing is ever deleted, it just
 * stops shouting.
 */
export function currentAnnouncements<T extends { at: string }>(
  all: T[],
  now: Date = new Date(),
  hours: number = ANNOUNCEMENT_HOURS_ON_HOME,
  max = 2,
): T[] {
  const cutoff = now.getTime() - hours * 60 * 60 * 1000;
  return [...all]
    .filter((a) => {
      const at = new Date(a.at).getTime();
      return Number.isFinite(at) && at >= cutoff;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, max);
}

// ── Validation ─────────────────────────────────────────────────────────────
// A single wrong stroke index makes the leaderboard quietly wrong all week, so
// course data is validated before it is ever used.

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateHoles(holes: Hole[], expectedPar: number): ValidationResult {
  const errors: string[] = [];
  if (holes.length !== 18) errors.push(`Expected 18 holes, got ${holes.length}.`);

  const sis = holes.map((h) => h.strokeIndex).sort((a, b) => a - b);
  const expected = Array.from({ length: 18 }, (_, i) => i + 1);
  if (sis.length !== 18 || !expected.every((v, i) => sis[i] === v)) {
    errors.push("Stroke indexes must be 1–18, each used exactly once.");
  }

  const parSum = holes.reduce((s, h) => s + h.par, 0);
  if (parSum !== expectedPar) {
    errors.push(`Pars sum to ${parSum}, expected ${expectedPar}.`);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Team balance checks. Warnings, not hard failures — the organiser picks the teams,
 * the app checks and warns (couples split, fourball split 2-2, equal sizes).
 */
export function validateTeams(
  teams: { id: string; name: string; playerIds: string[] }[],
  couples: { playerIds: [string, string] }[],
  lockedGroupIds: string[],
): string[] {
  const warnings: string[] = [];

  // An odd number of players can't split evenly, so one team may carry an extra. An even
  // number must split exactly — the tolerance follows the field rather than being fixed.
  const sizes = teams.map((t) => t.playerIds.length);
  const allowedGap = sizes.reduce((a, b) => a + b, 0) % 2;
  if (sizes.length > 0 && Math.max(...sizes) - Math.min(...sizes) > allowedGap) {
    warnings.push(`Teams are uneven: ${teams.map((t) => `${t.name} ${t.playerIds.length}`).join(", ")}.`);
  }

  const teamOf = (pid: string) => teams.find((t) => t.playerIds.includes(pid))?.id;

  for (const c of couples) {
    const [a, b] = c.playerIds;
    if (teamOf(a) && teamOf(a) === teamOf(b)) {
      warnings.push(`A couple is on the same team (${a} & ${b}); couples must be split.`);
    }
  }

  // The locked group should be split as evenly as its size allows across the two teams.
  const perTeam = new Map<string, number>();
  for (const pid of lockedGroupIds) {
    const t = teamOf(pid);
    if (t) perTeam.set(t, (perTeam.get(t) ?? 0) + 1);
  }
  const counts = [...perTeam.values()];
  const lockedGap = counts.reduce((a, b) => a + b, 0) % 2;
  if (lockedGroupIds.length > 0 && (counts.length < 2 || Math.max(...counts) - Math.min(...counts) > lockedGap)) {
    warnings.push("The locked group is not split across the two teams.");
  }

  return warnings;
}
