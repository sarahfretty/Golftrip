// The Belek Cup 2026 — seed data.
//
// Transcribed from data/courses.md (club-validated, 1 Aug 2026). This is the single
// source of truth for the first event. It is data, not code: a second trip is a new
// file of these same shapes. Playing handicaps are NOT stored here — they are derived
// by the scoring engine from index + tee + course, and the test suite asserts the
// engine reproduces the club's validated table exactly.

import type {
  Competition,
  Couple,
  Course,
  Hole,
  Player,
  Round,
  Team,
  Tee,
  Gender,
} from "../domain/types";

// Compact hole builder: [number, menDistance, ladiesDistance, par, strokeIndex]
type HoleRow = [number, number, number, number, number];

function holes(rows: HoleRow[], which: "men" | "ladies"): Hole[] {
  return rows.map(([number, menD, ladiesD, par, strokeIndex]) => ({
    number,
    par,
    strokeIndex,
    distance: which === "men" ? menD : ladiesD,
  }));
}

const NATIONAL_ROWS: HoleRow[] = [
  [1, 300, 282, 4, 11], [2, 134, 100, 3, 15], [3, 476, 468, 5, 3],
  [4, 305, 272, 4, 7], [5, 449, 372, 5, 1], [6, 447, 434, 5, 5],
  [7, 138, 109, 3, 17], [8, 320, 296, 4, 9], [9, 280, 249, 4, 13],
  [10, 286, 271, 4, 14], [11, 129, 108, 3, 18], [12, 362, 336, 4, 2],
  [13, 339, 318, 4, 12], [14, 328, 315, 4, 8], [15, 303, 290, 4, 6],
  [16, 444, 427, 5, 4], [17, 158, 142, 3, 16], [18, 325, 308, 4, 10],
];

const CARYA_ROWS: HoleRow[] = [
  [1, 348, 305, 4, 14], [2, 161, 112, 3, 16], [3, 349, 303, 4, 2],
  [4, 332, 280, 4, 6], [5, 325, 279, 4, 4], [6, 134, 85, 3, 10],
  [7, 442, 412, 5, 8], [8, 135, 119, 3, 18], [9, 342, 289, 4, 12],
  [10, 462, 394, 5, 3], [11, 315, 273, 4, 1], [12, 463, 386, 5, 13],
  [13, 328, 280, 4, 9], [14, 127, 109, 3, 17], [15, 445, 374, 5, 11],
  [16, 333, 260, 4, 15], [17, 366, 297, 4, 7], [18, 343, 305, 4, 5],
];

const MONTGOMERIE_ROWS: HoleRow[] = [
  [1, 443, 410, 5, 7], [2, 131, 107, 3, 17], [3, 285, 253, 4, 13],
  [4, 428, 378, 5, 9], [5, 154, 88, 3, 11], [6, 355, 336, 4, 5],
  [7, 383, 321, 4, 1], [8, 146, 121, 3, 15], [9, 349, 321, 4, 3],
  [10, 268, 246, 4, 16], [11, 458, 428, 5, 10], [12, 377, 340, 4, 2],
  [13, 444, 421, 5, 8], [14, 137, 119, 3, 14], [15, 278, 235, 4, 6],
  [16, 135, 109, 3, 18], [17, 307, 286, 4, 12], [18, 449, 403, 5, 4],
];

// Wheatley Golf Club, Doncaster — a home course, added to demo scoring. Men play Yellow
// (Par 71, CR 71.0 / Slope 129), ladies play Red (Par 74, CR 74.5 / Slope 139). Par and
// stroke index differ per tee, so holes are defined separately. Source: club scorecard +
// England Golf 95% handicap tables (from 20 Aug 2025). Distances in yards.
type HoleRow2 = [number, number, number, number]; // [number, par, strokeIndex, distance]
function holes2(rows: HoleRow2[]): Hole[] {
  return rows.map(([number, par, strokeIndex, distance]) => ({ number, par, strokeIndex, distance }));
}
const WHEATLEY_YELLOW: HoleRow2[] = [
  [1, 4, 16, 345], [2, 4, 4, 395], [3, 3, 14, 190], [4, 5, 10, 484], [5, 5, 8, 499],
  [6, 3, 18, 136], [7, 5, 2, 499], [8, 3, 12, 190], [9, 4, 6, 379],
  [10, 4, 1, 475], [11, 3, 15, 167], [12, 4, 5, 418], [13, 4, 7, 408], [14, 3, 13, 145],
  [15, 4, 17, 265], [16, 4, 9, 344], [17, 4, 3, 375], [18, 5, 11, 479],
];
const WHEATLEY_RED: HoleRow2[] = [
  [1, 4, 9, 325], [2, 5, 11, 385], [3, 3, 15, 141], [4, 5, 1, 477], [5, 5, 5, 455],
  [6, 3, 17, 126], [7, 5, 7, 470], [8, 3, 13, 146], [9, 4, 3, 361],
  [10, 5, 6, 439], [11, 3, 14, 160], [12, 5, 12, 402], [13, 4, 2, 396], [14, 3, 16, 132],
  [15, 4, 18, 238], [16, 4, 4, 330], [17, 4, 10, 347], [18, 5, 8, 457],
];

export const COURSES: Course[] = [
  {
    id: "wheatley",
    name: "Wheatley Golf Club",
    par: 71,
    distanceUnit: "yd",
    tees: [
      { tee: "yellow", gender: "M", courseRating: 71.0, slope: 129, holes: holes2(WHEATLEY_YELLOW) },
      { tee: "red", gender: "F", courseRating: 74.5, slope: 139, holes: holes2(WHEATLEY_RED) },
    ],
  },
  {
    id: "national",
    name: "The National Golf Club",
    par: 72,
    distanceUnit: "m",
    tees: [
      { tee: "yellow", gender: "M", courseRating: 69.9, slope: 129, holes: holes(NATIONAL_ROWS, "men") },
      { tee: "red", gender: "F", courseRating: 72.7, slope: 129, holes: holes(NATIONAL_ROWS, "ladies") },
    ],
  },
  {
    id: "carya",
    name: "Carya Golf Club",
    par: 72,
    distanceUnit: "m",
    tees: [
      { tee: "yellow", gender: "M", courseRating: 70.4, slope: 130, holes: holes(CARYA_ROWS, "men") },
      { tee: "red", gender: "F", courseRating: 71.0, slope: 127, holes: holes(CARYA_ROWS, "ladies") },
    ],
  },
  {
    id: "montgomerie",
    name: "Montgomerie Maxx Royal",
    par: 72,
    distanceUnit: "m",
    // Gold on the scorecard IS the men's yellow in the handicap table (confirmed by the club).
    tees: [
      { tee: "gold", gender: "M", courseRating: 69.4, slope: 125, holes: holes(MONTGOMERIE_ROWS, "men") },
      { tee: "red", gender: "F", courseRating: 70.9, slope: 130, holes: holes(MONTGOMERIE_ROWS, "ladies") },
    ],
  },
];

const FOURBALL = "ladies-fourball";

function player(
  id: string,
  name: string,
  fullName: string,
  gender: Gender,
  tee: Tee,
  index: number | null,
  opts: Partial<Player> = {},
): Player {
  return { id, name, fullName, gender, tee, index, competing: index !== null, ...opts };
}

export const PLAYERS: Player[] = [
  // Men — yellow (gold at Montgomerie)
  player("martin", "Martin", "Martin Barlow", "M", "yellow", 5.0),
  player("mark", "Mark", "Mark Davies", "M", "yellow", 7.5),
  player("paul", "Paul", "Paul Davies", "M", "yellow", 8.6),
  player("jim", "Jim", "Jim Campbell", "M", "yellow", 12.5),
  player("chris", "Chris", "Chris Harrod", "M", "yellow", 14.8),
  // Ladies — red
  player("sarah", "Sarah", "Sarah Barlow", "F", "red", 10.0, { organiser: true }),
  player("jane", "Jane", "Jane Davies", "F", "red", 13.2, { organiser: true }),
  player("nicky", "Nicky", "Nicky Harrod", "F", "red", 15.8),
  player("cynthia", "Cynthia", "Cynthia Porter", "F", "red", 18.7, { lockedGroup: FOURBALL }),
  player("kathy", "Kathy", "Kathy Houseman", "F", "red", 22.8, { lockedGroup: FOURBALL }),
  player("jo-irving", "Jo I", "Jo Irving", "F", "red", 23.5),
  player("debs", "Debs", "Debs Dugher", "F", "red", 26.0, { lockedGroup: FOURBALL }),
  player("jo-campbell", "Jo C", "Jo Campbell", "F", "red", 36.5),
  player("catherine", "Catherine", "Catherine Bailey", "F", "red", 45.0, {
    lockedGroup: FOURBALL,
    indexProvisional: true,
  }),
  // Attendees — not competing
  player("graham", "Graham", "Graham", "M", "yellow", null),
  player("michelle", "Michelle", "Michelle", "F", "red", null),
];

/** The ladies' fourball, locked together every round. */
export const LOCKED_FOURBALL = PLAYERS.filter((p) => p.lockedGroup === FOURBALL).map((p) => p.id);

// Teams are an open organiser decision: two fixed teams of seven, with the fourball
// split 2-2 and couples split across teams. Seeded unassigned — the organiser picks
// in-app and the engine warns on imbalance. See docs/ADMIN.md.
export const TEAMS: Team[] = [
  { id: "team-a", name: "Team A", playerIds: [] },
  { id: "team-b", name: "Team B", playerIds: [] },
];

// Couple pairings are personal data not fully specified in the handover. They exist
// only as a team-balancing constraint (couples split across teams). Left for the
// organiser to confirm rather than guessed from surnames.
export const COUPLES: Couple[] = [];

export const COMPETITIONS: Competition[] = [
  { id: "team-cup", name: "The Team Cup", type: "team-stableford", countingRounds: 2 },
  { id: "ladies-oom", name: "Ladies' Champion", type: "individual-stableford", gender: "F", countingRounds: 2 },
  { id: "mens-oom", name: "Men's Champion", type: "individual-stableford", gender: "M", countingRounds: 2 },
  { id: "ntp", name: "Nearest the Pin", type: "nearest-the-pin" },
  { id: "ld", name: "Longest Drive", type: "longest-drive" },
];

export const ROUNDS: Round[] = [
  // Warm-up on a home course — scoreable to demo the flow, excluded from the Cup.
  { id: "demo-wheatley", number: 0, courseId: "wheatley", date: "2026-09-01", teeWindow: "Warm-up", status: "upcoming", demo: true },
  { id: "r1", number: 1, courseId: "national", date: "2026-09-08", teeWindow: "09:30–10:06", status: "upcoming" },
  { id: "r2", number: 2, courseId: "carya", date: "2026-09-10", teeWindow: "10:12–10:49", status: "upcoming" },
  { id: "r3", number: 3, courseId: "montgomerie", date: "2026-09-12", teeWindow: "15:00–15:30", status: "upcoming", sealedUntilCeremony: true },
];

export const EVENT = {
  id: "belek-cup-2026",
  brand: "Golf Trips",
  name: "The Belek Cup 2026",
  location: "Belek, Turkey",
  startDate: "2026-09-07",
  endDate: "2026-09-14",
  ceremonyDate: "2026-09-13",
  allowance: 0.95,
  countingRounds: 2,
  hotel: { name: "Regnum Carya", nights: 7, board: "All Inclusive Plus" },
  flights: {
    out: { carrier: "Jet2", flightNo: "LS653", from: "EMA", to: "AYT", date: "2026-09-07", depart: "13:00", arrive: "19:25", duration: "4h 25m" },
    back: { carrier: "Jet2", flightNo: "LS654", from: "AYT", to: "EMA", date: "2026-09-14", depart: "20:15", arrive: "22:55", duration: "4h 40m" },
  },
} as const;

// Default tee draw. Shuffled per round in reality (organiser-editable); the fourball
// (Group Three) stays locked together every round. Seeded here so the app runs with a
// realistic draw out of the box. Scorer defaults to the first-named player in each group.
const DRAW: { name: string; playerIds: string[]; scorerId: string }[] = [
  { name: "Group One", playerIds: ["sarah", "martin", "jim", "nicky"], scorerId: "sarah" },
  { name: "Group Two", playerIds: ["jane", "mark", "jo-irving", "chris"], scorerId: "jane" },
  { name: "Group Three", playerIds: ["debs", "kathy", "cynthia", "catherine"], scorerId: "debs" },
  { name: "Group Four", playerIds: ["paul", "jo-campbell"], scorerId: "paul" },
];

export function defaultTeeGroups(): import("../domain/types").TeeGroup[] {
  return ROUNDS.flatMap((round) =>
    DRAW.map((g, i) => ({
      id: `${round.id}-g${i + 1}`,
      roundId: round.id,
      name: g.name,
      playerIds: g.playerIds,
      scorerId: g.scorerId,
    })),
  );
}

export const SEED = { EVENT, COURSES, PLAYERS, TEAMS, COUPLES, COMPETITIONS, ROUNDS };
export default SEED;
