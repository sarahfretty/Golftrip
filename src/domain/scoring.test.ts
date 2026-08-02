import { describe, it, expect } from "vitest";
import {
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
  validateHoles,
  validateTeams,
} from "./scoring";
import { COURSES, PLAYERS } from "../data/belek-cup-2026";
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
    cynthia: [21, 19, 19],
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
  it("teamStandings sums each member's best-2 total", () => {
    const rows = teamStandings(
      [
        { id: "t1", playerIds: ["a", "b"] },
        { id: "t2", playerIds: ["c"] },
      ],
      { a: [30, 20, 34], b: [33, 33, 10], c: [40, 40, 40] },
      2,
    );
    const t1 = rows.find((r) => r.teamId === "t1")!;
    expect(t1.total).toBe(64 + 66);
  });
});

describe("course data validation", () => {
  for (const course of COURSES) {
    for (const tee of course.tees) {
      it(`${course.name} (${tee.tee}) has valid SIs and pars`, () => {
        const result = validateHoles(tee.holes, course.par);
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
      });
    }
  }
});

describe("team balance validation", () => {
  it("warns when a couple shares a team and when the fourball is not split evenly", () => {
    const warnings = validateTeams(
      [
        { id: "a", name: "A", playerIds: ["p1", "p2", "cynthia", "kathy", "debs"] },
        { id: "b", name: "B", playerIds: ["p3", "catherine"] },
      ],
      [{ playerIds: ["p1", "p2"] }],
      ["cynthia", "kathy", "debs", "catherine"],
    );
    expect(warnings.some((w) => /couple/i.test(w))).toBe(true);
    expect(warnings.some((w) => /fourball/i.test(w))).toBe(true);
    expect(warnings.some((w) => /uneven/i.test(w))).toBe(true);
  });
  it("passes clean teams with the fourball split 2-2", () => {
    const warnings = validateTeams(
      [
        { id: "a", name: "A", playerIds: ["cynthia", "kathy"] },
        { id: "b", name: "B", playerIds: ["debs", "catherine"] },
      ],
      [],
      ["cynthia", "kathy", "debs", "catherine"],
    );
    expect(warnings).toEqual([]);
  });
});
