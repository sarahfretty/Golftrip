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

export const COURSES: Course[] = [
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

const LOCKED = "ladies-threeball";

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
  player("kathy", "Kathy", "Kathy Houseman", "F", "red", 22.8, { lockedGroup: LOCKED }),
  player("jo-irving", "Jo I", "Jo Irving", "F", "red", 23.5),
  player("debs", "Debs", "Debs Dugher", "F", "red", 26.0, { lockedGroup: LOCKED }),
  player("jo-campbell", "Jo C", "Jo Campbell", "F", "red", 36.5),
  player("catherine", "Catherine", "Catherine Bailey", "F", "red", 45.0, {
    lockedGroup: LOCKED,
    indexProvisional: true,
    // Plays every round and her card is recorded, but her scores are not in the
    // championships or the Team Cup. Side prizes are still open to her.
    competing: false,
  }),
  // Attendees — don't play at all
  player("graham", "Graham", "Graham", "M", "yellow", null),
  player("michelle", "Michelle", "Michelle", "F", "red", null),
];

/** Everyone who tees off. Attendees have no index and don't play; Catherine plays but doesn't score. */
export const PLAYING = PLAYERS.filter((p) => p.index !== null);

/** The ladies' group, locked together every round. */
export const LOCKED_GROUP_IDS = PLAYERS.filter((p) => p.lockedGroup === LOCKED).map((p) => p.id);

// The two teams, picked by the organiser (30 Aug 2026): six a side from the twelve golfers
// who score, plus everyone else on the trip in nonScoringIds — Catherine plays unscored,
// Graham and Michelle don't play. Editable in the Console; hidden until the organiser reveals.
export const TEAMS: Team[] = [
  { id: "team-gold", name: "Gold", playerIds: ["mark", "jim", "jane", "chris", "kathy", "jo-campbell"], nonScoringIds: ["michelle"] },
  { id: "team-aqua", name: "Aqua", playerIds: ["martin", "paul", "sarah", "nicky", "jo-irving", "debs"], nonScoringIds: ["catherine", "graham"] },
];

// Couples are NOT split across the teams — the organisers tried it and it didn't work
// out, so the constraint was dropped (30 Aug 2026). This list stays empty and the
// balance check stays dormant; populate it only if the rule is ever reinstated.
export const COUPLES: Couple[] = [];

export const COMPETITIONS: Competition[] = [
  { id: "team-cup", name: "The Team Cup", type: "team-stableford", countingRounds: 3 },
  { id: "ladies-oom", name: "Ladies' Champion", type: "individual-stableford", gender: "F", countingRounds: 3 },
  { id: "mens-oom", name: "Men's Champion", type: "individual-stableford", gender: "M", countingRounds: 3 },
  { id: "ntp-men", name: "Nearest the Pin — Men", type: "nearest-the-pin", gender: "M" },
  { id: "ntp-ladies", name: "Nearest the Pin — Ladies", type: "nearest-the-pin", gender: "F" },
  { id: "ld-men", name: "Longest Drive — Men", type: "longest-drive", gender: "M" },
  { id: "ld-ladies", name: "Longest Drive — Ladies", type: "longest-drive", gender: "F" },
];

export const ROUNDS: Round[] = [
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
  countingRounds: 3, // every round counts — no round is dropped (decided 30 Aug 2026)
  hotel: { name: "Regnum Carya", nights: 7, board: "All Inclusive Plus" },
  flights: {
    out: { carrier: "Jet2", flightNo: "LS653", from: "EMA", to: "AYT", date: "2026-09-07", depart: "13:00", arrive: "19:25", duration: "4h 25m" },
    back: { carrier: "Jet2", flightNo: "LS654", from: "AYT", to: "EMA", date: "2026-09-14", depart: "20:15", arrive: "22:55", duration: "4h 40m" },
  },
} as const;

// Tee draws rotate every round so partners don't repeat, with an even men/women mix in
// each group. The ladies' threeball (Kathy, Debs, Catherine) stays locked together every
// round — the one deliberate exception. Computed to minimise repeat pairings across
// the three rounds; organiser-editable in the app.
type DrawGroup = { name: string; playerIds: string[]; scorerId: string };
const LOCKED_GROUP: DrawGroup = {
  name: "The Threeball",
  playerIds: ["kathy", "debs", "catherine"],
  scorerId: "debs",
};
const DRAWS: Record<string, DrawGroup[]> = {
  r1: [
    { name: "Group 1", playerIds: ["jim", "sarah", "chris", "jo-campbell"], scorerId: "sarah" },
    { name: "Group 2", playerIds: ["martin", "nicky", "paul"], scorerId: "martin" },
    { name: "Group 3", playerIds: ["mark", "jo-irving", "jane"], scorerId: "jane" },
    LOCKED_GROUP,
  ],
  r2: [
    { name: "Group 1", playerIds: ["jim", "jane", "martin", "jo-campbell"], scorerId: "jane" },
    { name: "Group 2", playerIds: ["paul", "sarah", "mark"], scorerId: "sarah" },
    { name: "Group 3", playerIds: ["chris", "jo-irving", "nicky"], scorerId: "chris" },
    LOCKED_GROUP,
  ],
  r3: [
    { name: "Group 1", playerIds: ["martin", "sarah", "chris", "jane"], scorerId: "sarah" },
    { name: "Group 2", playerIds: ["mark", "nicky", "jim"], scorerId: "jim" },
    { name: "Group 3", playerIds: ["paul", "jo-irving", "jo-campbell"], scorerId: "paul" },
    LOCKED_GROUP,
  ],
};

export function defaultTeeGroups(): import("../domain/types").TeeGroup[] {
  return ROUNDS.flatMap((round) => {
    const draw = DRAWS[round.id] ?? [];
    return draw.map((g, i) => ({
      id: `${round.id}-g${i + 1}`,
      roundId: round.id,
      name: g.name,
      playerIds: g.playerIds,
      scorerId: g.scorerId,
    }));
  });
}

export const SEED = { EVENT, COURSES, PLAYERS, TEAMS, COUPLES, COMPETITIONS, ROUNDS };
export default SEED;
