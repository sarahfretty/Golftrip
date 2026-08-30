import { describe, it, expect } from "vitest";
import {
  CARDS_PER_ROUND,
  playingHandicap,
  shotsOnHole,
  shotsMap,
  holePoints,
  cardPoints,
  cardGross,
  formatGross,
  bestNTotal,
  orderOfMerit,
  teamStandings,
  teePar,
  validateHoles,
  validateTeams,
} from "./scoring";
import { COMPETITIONS, COUPLES, COURSES, EVENT, PLAYERS, PLAYING, ROUNDS, TEAMS, LOCKED_GROUP_IDS, defaultTeeGroups } from "../data/belek-cup-2026";
import type { Course, Player, TeeSet } from "./types";

function teeFor(course: Course, player: Player): TeeSet {
  const set = course.tees.find((t) => t.gender === player.gender);
  if (!set) throw new Error(`No tee for ${player.name} on ${course.name}`);
  return set;
}

describe("playing handicaps reproduce the club-validated table (courses.md, 1 Aug 2026)", () => {
  // [national, carya, montgomerie] — the numbers the app must use.
  const EXPECTED: Record<string, [number, number, number]> = {
    martin: [3, 4, 3],
    mark: [6, 7, 5],
    paul: [7, 8, 7],
    sarah: [12, 10, 10],
    jim: [12, 12, 11],
    jane: [15, 13, 13],
    chris: [14, 15, 13],
    nicky: [18, 16, 16],
    kathy: [25, 23, 24],
    "jo-irving": [26, 24, 25],
    debs: [29, 27, 27],
    "jo-campbell": [40, 38, 39],
    catherine: [49, 47, 48],
  };

  const byId = (id: string) => PLAYERS.find((p) => p.id === id)!;
  const course = (id: string) => COURSES.find((c) => c.id === id)!;

  for (const [pid, [nat, car, mon]] of Object.entries(EXPECTED)) {
    it(`${pid} → National ${nat}, Carya ${car}, Montgomerie ${mon}`, () => {
      const p = byId(pid);
      const ph = (cid: string) => {
        const c = course(cid);
        return playingHandicap(p.index!, teeFor(c, p), c.par);
      };
      expect(ph("national")).toBe(nat);
      expect(ph("carya")).toBe(car);
      expect(ph("montgomerie")).toBe(mon);
    });
  }
});

describe("shotsOnHole", () => {
  it("ph 20 gives two shots on SI 1–2, one on SI 3–18", () => {
    expect(shotsOnHole(20, 1)).toBe(2);
    expect(shotsOnHole(20, 2)).toBe(2);
    expect(shotsOnHole(20, 3)).toBe(1);
    expect(shotsOnHole(20, 18)).toBe(1);
  });
  it("ph 27 gives two shots on SI 1–9, one on SI 10–18", () => {
    expect(shotsOnHole(27, 9)).toBe(2);
    expect(shotsOnHole(27, 10)).toBe(1);
  });
  it("ph 47 (Catherine) stacks to three shots on the lowest SIs", () => {
    expect(shotsOnHole(47, 1)).toBe(3); // 47 = 2*18 + 11 → SI 1–11 get 3
    expect(shotsOnHole(47, 11)).toBe(3);
    expect(shotsOnHole(47, 12)).toBe(2);
  });
  it("ph 18 gives exactly one shot on every hole; ph 0 gives none", () => {
    for (let si = 1; si <= 18; si++) {
      expect(shotsOnHole(18, si)).toBe(1);
      expect(shotsOnHole(0, si)).toBe(0);
    }
  });
  it("plus-handicaps give shots back from the easiest holes first", () => {
    expect(shotsOnHole(-1, 18)).toBe(-1);
    expect(shotsOnHole(-1, 17)).toBe(0);
  });
});

describe("holePoints (Stableford)", () => {
  it("net par = 2, net birdie = 3, net bogey = 1, net double = 0", () => {
    expect(holePoints(4, 4, 0)).toBe(2); // par
    expect(holePoints(3, 4, 0)).toBe(3); // birdie
    expect(holePoints(5, 4, 0)).toBe(1); // bogey
    expect(holePoints(6, 4, 0)).toBe(0); // double bogey
    expect(holePoints(7, 4, 0)).toBe(0); // never negative
  });
  it("applies shots received: gross 6 with a shot on a par 4 = net bogey = 1", () => {
    expect(holePoints(6, 4, 1)).toBe(1);
    expect(holePoints(5, 4, 2)).toBe(3); // net 3 on a par 4 = birdie
  });
  it("X (no return) and blank holes score zero", () => {
    expect(holePoints("X", 4, 3)).toBe(0);
    expect(holePoints(null, 4, 3)).toBe(0);
  });
});

describe("cardPoints", () => {
  const holes = COURSES.find((c) => c.id === "carya")!.tees.find((t) => t.gender === "F")!.holes;
  it("a level-par gross card off scratch scores 36 points", () => {
    const strokes = holes.map((h) => h.par);
    expect(cardPoints({ strokes }, holes, 0)).toBe(36);
  });
  it("shots received lift the total by exactly one point per shot", () => {
    const strokes = holes.map((h) => h.par);
    const totalShots = Object.values(shotsMap(27, holes)).reduce((a, b) => a + b, 0);
    expect(totalShots).toBe(27); // ph 27 = one shot on every hole plus a second on SI 1–9
    // On a level-par gross card, each shot converts a net par into one more point: total = 36 + shots.
    expect(cardPoints({ strokes }, holes, 27)).toBe(36 + totalShots);
  });
});

describe("cardGross — honest or not shown", () => {
  it("a complete numeric card gives a true gross", () => {
    const g = cardGross({ strokes: Array(18).fill(4) });
    expect(g).toEqual({ total: 72, isFloor: false, entered: 18 });
    expect(formatGross(g)).toBe("72");
  });
  it("any X makes the gross a floor (84+), never a fabricated total", () => {
    const strokes = [...Array(17).fill(4), "X" as const];
    const g = cardGross({ strokes });
    expect(g.isFloor).toBe(true);
    expect(formatGross(g)).toBe("68+");
  });
  it("an incomplete card has no true gross", () => {
    const strokes = [...Array(17).fill(4), null];
    expect(cardGross({ strokes }).isFloor).toBe(true);
  });
});

describe("best-2-of-3 and standings", () => {
  it("bestNTotal drops the worst round", () => {
    expect(bestNTotal([30, 20, 34], 2)).toBe(64); // drops 20
    expect(bestNTotal([31, 0, 29], 2)).toBe(60); // a no-return (0) is dropped
  });
  it("orderOfMerit ranks by best-2 total, high to low", () => {
    const rows = orderOfMerit({ a: [30, 20, 34], b: [33, 33, 10], c: [40, 0, 0] }, 2);
    expect(rows.map((r) => r.playerId)).toEqual(["b", "a", "c"]); // 66, 64, 40
    expect(rows[0].total).toBe(66);
  });
  it("teamStandings adds the round scores, not each member's best-2 total", () => {
    const rows = teamStandings(
      [
        { id: "t1", playerIds: ["a", "b"] },
        { id: "t2", playerIds: ["c"] },
      ],
      { a: [30, 20, 34], b: [33, 33, 10], c: [40, 40, 40] },
      2,
    );
    const t1 = rows.find((r) => r.teamId === "t1")!;
    // Both members are inside a five-card allowance, so every card counts:
    // rounds score 63, 53 and 44, and the best two of those make the total.
    expect(t1.roundScores).toEqual([63, 53, 44]);
    expect(t1.total).toBe(63 + 53);
  });
});

describe("course data validation", () => {
  for (const course of COURSES) {
    for (const tee of course.tees) {
      it(`${course.name} (${tee.tee}) has valid SIs and pars`, () => {
        // Validate each tee against its own par (a course can differ per tee, e.g. Wheatley).
        const result = validateHoles(tee.holes, teePar(tee));
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
      });
    }
  }
});

describe("tee draw rotates without repeating partners", () => {
  const compRounds = ROUNDS;
  const golfers = PLAYING.map((p) => p.id); // everyone who tees off, scored or not
  const groupsByRound = (rid: string) => defaultTeeGroups().filter((g) => g.roundId === rid);

  it("covers everyone who tees off exactly once per round", () => {
    for (const r of compRounds) {
      const ids = groupsByRound(r.id).flatMap((g) => g.playerIds).sort();
      expect(ids).toEqual([...golfers].sort());
    }
  });

  it("keeps the ladies' threeball together every round", () => {
    for (const r of compRounds) {
      const locked = groupsByRound(r.id).find((g) => LOCKED_GROUP_IDS.every((id: string) => g.playerIds.includes(id)));
      expect(locked).toBeTruthy();
      expect(locked!.playerIds.length).toBe(LOCKED_GROUP_IDS.length);
    }
  });

  it("each group has a scorer drawn from its own players", () => {
    for (const g of defaultTeeGroups()) expect(g.playerIds).toContain(g.scorerId);
  });

  it("no partnership outside the threeball repeats in all three rounds", () => {
    const locked = new Set(LOCKED_GROUP_IDS);
    const count = new Map<string, number>();
    for (const r of compRounds) {
      for (const g of groupsByRound(r.id)) {
        for (let i = 0; i < g.playerIds.length; i++)
          for (let j = i + 1; j < g.playerIds.length; j++) {
            const [a, b] = [g.playerIds[i], g.playerIds[j]].sort();
            if (locked.has(a) && locked.has(b)) continue; // the threeball repeats on purpose
            const k = `${a}~${b}`;
            count.set(k, (count.get(k) ?? 0) + 1);
          }
      }
    }
    const tripled = [...count.entries()].filter(([, c]) => c >= 3);
    expect(tripled).toEqual([]);
  });
});

describe("team balance validation", () => {
  const THREEBALL = ["kathy", "debs", "catherine"];

  it("warns when a couple shares a team, the threeball is not split, and sizes are far apart", () => {
    const warnings = validateTeams(
      [
        { id: "a", name: "A", playerIds: ["p1", "p2", ...THREEBALL] },
        { id: "b", name: "B", playerIds: ["p3"] },
      ],
      [{ playerIds: ["p1", "p2"] }],
      THREEBALL,
    );
    expect(warnings.some((w) => /couple/i.test(w))).toBe(true);
    expect(warnings.some((w) => /locked group/i.test(w))).toBe(true);
    expect(warnings.some((w) => /uneven/i.test(w))).toBe(true);
  });

  it("passes seven against six — an odd field may split one apart", () => {
    const warnings = validateTeams(
      [
        { id: "a", name: "A", playerIds: ["kathy", "debs", "m1", "m2", "m3", "m4", "m5"] },
        { id: "b", name: "B", playerIds: ["catherine", "m6", "m7", "m8", "m9", "m10"] },
      ],
      [],
      THREEBALL,
    );
    expect(warnings).toEqual([]);
  });

  it("warns when one team carries two more players than the other", () => {
    const warnings = validateTeams(
      [
        { id: "a", name: "A", playerIds: ["kathy", "debs", "m1", "m2", "m3", "m4", "m5", "m6"] },
        { id: "b", name: "B", playerIds: ["catherine", "m7", "m8", "m9", "m10"] },
      ],
      [],
      THREEBALL,
    );
    expect(warnings.some((w) => /uneven/i.test(w))).toBe(true);
  });
});

describe("who counts and who plays", () => {
  const byId = (id: string) => PLAYERS.find((p) => p.id === id)!;

  it("Catherine plays every round but is not in the scoring field", () => {
    const catherine = byId("catherine");
    expect(catherine.index).not.toBeNull(); // her card is still handicapped and recorded
    expect(catherine.competing).toBe(false);
    expect(PLAYING.map((p) => p.id)).toContain("catherine");
    for (const r of ROUNDS) {
      const inAGroup = defaultTeeGroups()
        .filter((g) => g.roundId === r.id)
        .some((g) => g.playerIds.includes("catherine"));
      expect(inAGroup).toBe(true);
    }
  });

  it("attendees neither play nor score", () => {
    for (const id of ["graham", "michelle"]) {
      expect(byId(id).index).toBeNull();
      expect(byId(id).competing).toBe(false);
      expect(PLAYING.map((p) => p.id)).not.toContain(id);
    }
  });

  it("twelve golfers score, split six a side", () => {
    const scoring = PLAYERS.filter((p) => p.competing);
    expect(scoring.length).toBe(12);
    expect(scoring.length % 2).toBe(0);
  });

  it("nearest the pin and longest drive are each played for by men and ladies separately", () => {
    for (const type of ["nearest-the-pin", "longest-drive"]) {
      const comps = COMPETITIONS.filter((c) => c.type === type);
      expect(comps.map((c) => c.gender).sort()).toEqual(["F", "M"]);
    }
  });
});

describe("even fields must split exactly", () => {
  // Twelve scoring golfers, with the two locked ladies' scorers on opposite teams.
  const TEAM_A = ["martin", "mark", "paul", "jim", "chris", "kathy"];
  const TEAM_B = ["sarah", "jane", "nicky", "jo-irving", "debs", "jo-campbell"];
  const LOCKED = ["kathy", "debs"];

  it("passes a clean six against six", () => {
    const warnings = validateTeams(
      [
        { id: "a", name: "A", playerIds: TEAM_A },
        { id: "b", name: "B", playerIds: TEAM_B },
      ],
      [],
      LOCKED,
    );
    expect(warnings).toEqual([]);
  });

  it("warns at seven against five, which an even field should never be", () => {
    const warnings = validateTeams(
      [
        { id: "a", name: "A", playerIds: [...TEAM_A, "sarah"] },
        { id: "b", name: "B", playerIds: TEAM_B.filter((id) => id !== "sarah") },
      ],
      [],
      LOCKED,
    );
    expect(warnings.some((w) => /uneven/i.test(w))).toBe(true);
  });
});

describe("Team Cup counts the best five cards a round", () => {
  const team = (id: string, playerIds: string[]) => ({ id, name: id, playerIds });
  const SIX = ["p1", "p2", "p3", "p4", "p5", "p6"];

  it("counts five cards a round by default", () => {
    expect(CARDS_PER_ROUND).toBe(5);
  });

  it("drops the worst card in each round, then keeps the best two rounds", () => {
    const totals: Record<string, number[]> = {
      p1: [30, 10, 20], p2: [28, 10, 20], p3: [26, 10, 20],
      p4: [24, 10, 20], p5: [22, 10, 20], p6: [2, 10, 20],
    };
    const [row] = teamStandings([team("a", SIX)], totals, 2);
    // R1 drops the 2; R2 and R3 are flat so any five count.
    expect(row.roundScores).toEqual([130, 50, 100]);
    expect(row.total).toBe(230); // best two rounds: 130 + 100
  });

  it("a sixth card cannot help a team — equal best fives tie", () => {
    const base = { p1: [30], p2: [28], p3: [26], p4: [24], p5: [22] };
    const rows = teamStandings(
      [team("a", SIX), team("b", ["q1", "q2", "q3", "q4", "q5", "q6"])],
      {
        ...base, p6: [2],
        q1: [30], q2: [28], q3: [26], q4: [24], q5: [22], q6: [21],
      },
      1,
    );
    expect(rows[0].total).toBe(rows[1].total);
  });

  it("a bigger team gets no edge — seven against six ties on the same best five", () => {
    const rows = teamStandings(
      [team("sevens", [...SIX, "p7"]), team("sixes", ["q1", "q2", "q3", "q4", "q5", "q6"])],
      {
        p1: [30], p2: [28], p3: [26], p4: [24], p5: [22], p6: [8], p7: [7],
        q1: [30], q2: [28], q3: [26], q4: [24], q5: [22], q6: [8],
      },
      1,
    );
    expect(rows[0].total).toBe(130);
    expect(rows[1].total).toBe(130);
  });

  it("credits only the cards that counted, in the rounds that counted", () => {
    const totals: Record<string, number[]> = {
      p1: [10, 1], p2: [9, 1], p3: [8, 1], p4: [7, 1], p5: [6, 1], p6: [5, 1],
    };
    const [row] = teamStandings([team("a", SIX)], totals, 1);
    expect(row.total).toBe(40); // round one only, p6's 5 dropped
    const by = Object.fromEntries(row.contributions.map((c) => [c.playerId, c.total]));
    expect(by).toEqual({ p1: 10, p2: 9, p3: 8, p4: 7, p5: 6, p6: 0 });
  });
});

describe("the seeded teams", () => {
  it("are six a side and cover every scoring golfer exactly once", () => {
    const scoring = PLAYERS.filter((p) => p.competing).map((p) => p.id).sort();
    const picked = TEAMS.flatMap((t) => t.playerIds);
    expect(TEAMS.map((t) => t.playerIds.length)).toEqual([6, 6]);
    expect([...picked].sort()).toEqual(scoring);
    expect(new Set(picked).size).toBe(picked.length); // nobody on both teams
  });

  it("leave Catherine out of the scoring six — she plays but doesn't score", () => {
    expect(TEAMS.flatMap((t) => t.playerIds)).not.toContain("catherine");
  });

  it("put nobody in two places at once", () => {
    const everyone = TEAMS.flatMap((t) => [...t.playerIds, ...t.nonScoringIds]);
    expect(new Set(everyone).size).toBe(everyone.length);
  });

  it("place every single traveller on a team", () => {
    const onATeam = TEAMS.flatMap((t) => [...t.playerIds, ...t.nonScoringIds]).sort();
    expect(onATeam).toEqual(PLAYERS.map((p) => p.id).sort());
  });

  it("keep the non-scoring members out of the scoring six", () => {
    for (const t of TEAMS) {
      for (const id of t.nonScoringIds) {
        expect(PLAYERS.find((p) => p.id === id)!.competing).toBe(false);
      }
    }
  });

  it("never let a non-scoring member affect a team's total", () => {
    const totals = { p1: [10], p2: [9], p3: [8], p4: [7], p5: [6], p6: [5], ghost: [99] };
    const bare = teamStandings(
      [{ id: "t", playerIds: ["p1", "p2", "p3", "p4", "p5", "p6"] }], totals, 1,
    );
    // nonScoringIds is not part of teamStandings' input at all — the 99 cannot leak in.
    expect(bare[0].total).toBe(40);
    expect(bare[0].contributions.map((c) => c.playerId)).not.toContain("ghost");
  });

  it("split the locked ladies' scorers across the two teams", () => {
    const scoringLocked = LOCKED_GROUP_IDS.filter(
      (id: string) => PLAYERS.find((p) => p.id === id)!.competing,
    );
    const teamsUsed = new Set(
      scoringLocked.map((id: string) => TEAMS.find((t) => t.playerIds.includes(id))!.id),
    );
    expect(teamsUsed.size).toBe(scoringLocked.length);
  });

  it("raise no balance warnings", () => {
    expect(validateTeams(TEAMS, COUPLES, LOCKED_GROUP_IDS)).toEqual([]);
  });
});

describe("every round counts", () => {
  it("the event and all three competitions drop nothing", () => {
    expect(EVENT.countingRounds).toBe(3);
    expect(EVENT.countingRounds).toBe(ROUNDS.length);
    for (const c of COMPETITIONS.filter((x) => x.countingRounds !== undefined)) {
      expect(c.countingRounds).toBe(ROUNDS.length);
    }
  });

  it("a bad round can no longer be dropped from an individual total", () => {
    // Best-3-of-3 is a plain sum: the 0 stays in.
    expect(bestNTotal([31, 0, 29], 3)).toBe(60);
    expect(bestNTotal([31, 0, 29], 2)).toBe(60); // unchanged: the 0 was dropped anyway
    expect(bestNTotal([31, 12, 29], 3)).toBe(72);
    expect(bestNTotal([31, 12, 29], 2)).toBe(60); // the old rule dropped the 12
  });

  it("a team keeps every round score too", () => {
    const totals = { p1: [30, 5, 20], p2: [28, 5, 20], p3: [26, 5, 20],
                     p4: [24, 5, 20], p5: [22, 5, 20], p6: [2, 5, 20] };
    const [row] = teamStandings([{ id: "t", playerIds: ["p1","p2","p3","p4","p5","p6"] }], totals, 3);
    expect(row.roundScores).toEqual([130, 25, 100]);
    expect(row.total).toBe(255); // all three, including the poor middle round
  });
});
