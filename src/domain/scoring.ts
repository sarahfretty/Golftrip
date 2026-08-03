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
  /** Each member's best-N contribution. */
  contributions: { playerId: string; total: number }[];
}

/**
 * Team Cup: each member's worst round is dropped (best-N), then member totals are summed.
 */
export function teamStandings(
  teams: { id: string; playerIds: string[] }[],
  roundTotalsByPlayer: Record<string, number[]>,
  countingRounds: number,
): TeamStandingRow[] {
  return teams
    .map((team) => {
      const contributions = team.playerIds.map((playerId) => ({
        playerId,
        total: bestNTotal(roundTotalsByPlayer[playerId] ?? [], countingRounds),
      }));
      return {
        teamId: team.id,
        total: contributions.reduce((s, c) => s + c.total, 0),
        contributions,
      };
    })
    .sort((a, b) => b.total - a.total);
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

  const sizes = teams.map((t) => t.playerIds.length);
  if (new Set(sizes).size > 1) {
    warnings.push(`Teams are uneven: ${teams.map((t) => `${t.name} ${t.playerIds.length}`).join(", ")}.`);
  }

  const teamOf = (pid: string) => teams.find((t) => t.playerIds.includes(pid))?.id;

  for (const c of couples) {
    const [a, b] = c.playerIds;
    if (teamOf(a) && teamOf(a) === teamOf(b)) {
      warnings.push(`A couple is on the same team (${a} & ${b}); couples must be split.`);
    }
  }

  // The locked fourball should be split evenly across the two teams.
  const perTeam = new Map<string, number>();
  for (const pid of lockedGroupIds) {
    const t = teamOf(pid);
    if (t) perTeam.set(t, (perTeam.get(t) ?? 0) + 1);
  }
  const counts = [...perTeam.values()];
  if (lockedGroupIds.length > 0 && (counts.length < 2 || Math.max(...counts) - Math.min(...counts) > 0)) {
    warnings.push("The locked fourball is not split evenly across the two teams.");
  }

  return warnings;
}
