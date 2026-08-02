// Core domain types for Golf Trips.
//
// These are event-agnostic on purpose: The Belek Cup 2026 is the first event,
// but nothing here hard-codes Belek. A second trip is new data of these shapes,
// not new types.

export type Id = string;

export type Tee = "yellow" | "red" | "gold" | "white" | "blue";
export type Gender = "M" | "F";

/** A single hole's fixed course data for one tee. */
export interface Hole {
  /** 1–18 */
  number: number;
  par: number;
  /** Stroke index, 1–18, each used exactly once across the 18 holes. */
  strokeIndex: number;
  /** Yardage/metreage for this tee. */
  distance: number;
}

/** The competition attributes of one tee on one course. */
export interface TeeSet {
  tee: Tee;
  /** Which players use this tee, by gender, in this event. */
  gender: Gender;
  courseRating: number;
  slope: number;
  holes: Hole[];
}

export interface Course {
  id: Id;
  name: string;
  par: number;
  /** Distances are in this unit (Belek courses are in metres). */
  distanceUnit: "m" | "yd";
  tees: TeeSet[];
}

export interface Player {
  id: Id;
  /** Display name — must be unique within an event (see risk: "Two Jos"). */
  name: string;
  fullName: string;
  gender: Gender;
  tee: Tee;
  /** WHS index, frozen pre-tour. Null for non-competing attendees. */
  index: number | null;
  /** True when the index is a provisional organiser decision (e.g. Catherine). */
  indexProvisional?: boolean;
  competing: boolean;
  organiser?: boolean;
  /** Locked into a fixed group every round (the ladies' fourball). */
  lockedGroup?: string;
}

export interface Team {
  id: Id;
  name: string;
  /** Player ids. Two fixed teams of seven, assigned by the organiser. */
  playerIds: Id[];
}

/** A couple — used only as a team-balancing constraint (split across teams). */
export interface Couple {
  playerIds: [Id, Id];
}

export type RoundStatus =
  | "upcoming" // before play
  | "scoring" // cards being entered
  | "sealed" // complete but standings withheld (final round until ceremony)
  | "declared" // standings released
  | "locked"; // organiser has locked results; no more edits

export interface Round {
  id: Id;
  /** 1-based round number within the event. */
  number: number;
  courseId: Id;
  /** ISO date, e.g. "2026-09-08". */
  date: string;
  /** Human tee window, e.g. "09:30–10:06". */
  teeWindow: string;
  status: RoundStatus;
  /** Round 3 is sealed until the ceremony. */
  sealedUntilCeremony?: boolean;
}

/** One player's card for one round: 18 gross strokes, or X (no return) per hole. */
export type HoleScore = number | "X" | null;

export interface Scorecard {
  id: Id;
  roundId: Id;
  playerId: Id;
  /** Length 18. null = not yet entered, number = gross, "X" = no return. */
  strokes: HoleScore[];
  /** Set when the nominated scorer signs. */
  signedBy?: Id;
  signedAt?: string;
  /** Audit trail of organiser corrections. */
  corrections?: Correction[];
}

export interface Correction {
  hole: number;
  from: HoleScore;
  to: HoleScore;
  by: Id;
  at: string;
}

export type CompetitionType =
  | "individual-stableford" // Order of Merit over the counting rounds
  | "team-stableford" // Team Cup, derived from individual points
  | "nearest-the-pin"
  | "longest-drive";

export interface Competition {
  id: Id;
  name: string;
  type: CompetitionType;
  /** For individual comps: which gender field competes. */
  gender?: Gender;
  /** Best N of the event's rounds count (Belek: best 2 of 3). */
  countingRounds?: number;
}

/** A side-prize result (NTP/LD), entered per round by an organiser. */
export interface SidePrize {
  roundId: Id;
  competitionId: Id;
  /** The hole it was played on. */
  hole: number;
  winnerId: Id | null;
}

/** A tee group for one round. Shuffled per round; the ladies' fourball stays locked. */
export interface TeeGroup {
  id: Id;
  roundId: Id;
  name: string;
  playerIds: Id[];
  /** The one player who enters this group's card. */
  scorerId: Id;
}

/** An organiser-to-everyone message. */
export interface Announcement {
  id: Id;
  title: string;
  body: string;
  /** ISO timestamp. */
  at: string;
  by: Id;
}
