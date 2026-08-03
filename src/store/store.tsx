/*
 * Event store.
 *
 * Holds the mutable state of the event (cards, round status, teams, groups, side prizes,
 * announcements) and exposes it plus the derived leaderboards to the app. The static
 * config (event, courses, players) comes from seed data; the mutable state persists to
 * localStorage in this local adapter.
 *
 * This is the seam for Supabase: the shape of `EventState` and the action names map 1:1
 * onto the Postgres tables in supabase/schema.sql. Swapping the persistence layer means
 * replacing the localStorage read/write here with Supabase queries + realtime — the
 * components and selectors do not change. See docs/DATABASE.md.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  COMPETITIONS,
  COURSES,
  EVENT,
  PLAYERS,
  ROUNDS,
  TEAMS,
  COUPLES,
  LOCKED_FOURBALL,
  defaultTeeGroups,
} from "../data/belek-cup-2026";
import type {
  Announcement,
  Course,
  HoleScore,
  Player,
  Round,
  RoundStatus,
  Scorecard,
  SidePrize,
  Team,
  TeeGroup,
  TeeSet,
} from "../domain/types";
import {
  cardPoints,
  orderOfMerit,
  playingHandicap,
  shotsMap,
  teamStandings,
  teePar,
  type StandingRow,
  type TeamStandingRow,
} from "../domain/scoring";

const STORAGE_KEY = "golftrips:belek-cup-2026:v1";

interface EventState {
  rounds: Round[];
  teams: Team[];
  teeGroups: TeeGroup[];
  scorecards: Record<string, Scorecard>; // key: `${roundId}:${playerId}`
  sidePrizes: SidePrize[];
  announcements: Announcement[];
}

function cardKey(roundId: string, playerId: string) {
  return `${roundId}:${playerId}`;
}

function emptyCard(roundId: string, playerId: string): Scorecard {
  return {
    id: cardKey(roundId, playerId),
    roundId,
    playerId,
    strokes: Array(18).fill(null),
    corrections: [],
  };
}

function initialState(): EventState {
  return {
    rounds: ROUNDS.map((r) => ({ ...r })),
    teams: TEAMS.map((t) => ({ ...t, playerIds: [...t.playerIds] })),
    teeGroups: defaultTeeGroups(),
    scorecards: {},
    sidePrizes: [],
    announcements: [],
  };
}

function loadState(): EventState {
  const base = initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<EventState>;
    // Merge BY ID against the seed so newly-added rounds/groups/courses always appear,
    // while preserving anything the organiser has changed (status, scorer, teams, scores).
    const rounds = base.rounds.map((r) => {
      const saved = parsed.rounds?.find((x) => x.id === r.id);
      return saved ? { ...r, status: saved.status } : r;
    });
    const teeGroups = base.teeGroups.map((g) => {
      const saved = parsed.teeGroups?.find((x) => x.id === g.id);
      return saved ? { ...g, scorerId: saved.scorerId } : g;
    });
    const teams = base.teams.map((t) => {
      const saved = parsed.teams?.find((x) => x.id === t.id);
      return saved ? { ...t, playerIds: saved.playerIds } : t;
    });
    return {
      rounds,
      teams,
      teeGroups,
      scorecards: parsed.scorecards ?? base.scorecards,
      sidePrizes: parsed.sidePrizes ?? base.sidePrizes,
      announcements: parsed.announcements ?? base.announcements,
    };
  } catch {
    return base;
  }
}

// Organiser PIN — local adapter only. Production uses Supabase Auth (see docs/AUTH).
const ORGANISER_PIN = import.meta.env.VITE_ORGANISER_PIN ?? "belek2026";

export interface EventContextValue {
  // Static config
  event: typeof EVENT;
  courses: Course[];
  players: Player[];
  competitions: typeof COMPETITIONS;
  couples: typeof COUPLES;
  lockedFourball: string[];
  // Mutable state
  rounds: Round[];
  teams: Team[];
  teeGroups: TeeGroup[];
  sidePrizes: SidePrize[];
  announcements: Announcement[];
  // Session
  currentPlayerId: string | null;
  isOrganiser: boolean;
  // Lookups
  getPlayer: (id: string) => Player | undefined;
  getCourse: (id: string) => Course | undefined;
  teeFor: (course: Course, player: Player) => TeeSet | undefined;
  playingHandicapFor: (playerId: string, roundId: string) => number | null;
  cardFor: (roundId: string, playerId: string) => Scorecard;
  groupsForRound: (roundId: string) => TeeGroup[];
  groupForPlayer: (roundId: string, playerId: string) => TeeGroup | undefined;
  // Derived scoring
  pointsFor: (roundId: string, playerId: string) => number;
  shotsFor: (roundId: string, playerId: string) => Record<number, number>;
  orderOfMeritFor: (gender: "M" | "F") => StandingRow[];
  teamCup: () => TeamStandingRow[];
  // Actions — session
  selectPlayer: (id: string | null) => void;
  loginOrganiser: (pin: string) => boolean;
  logoutOrganiser: () => void;
  // Actions — scoring
  setStroke: (roundId: string, playerId: string, hole: number, value: HoleScore) => void;
  signCard: (roundId: string, playerId: string, by: string) => void;
  correctStroke: (roundId: string, playerId: string, hole: number, value: HoleScore, by: string) => void;
  // Actions — organiser
  setRoundStatus: (roundId: string, status: RoundStatus) => void;
  setSidePrize: (roundId: string, competitionId: string, hole: number, winnerId: string | null) => void;
  setGroupScorer: (groupId: string, playerId: string) => void;
  setTeams: (teams: Team[]) => void;
  addAnnouncement: (title: string, body: string, by: string) => void;
  resetAll: () => void;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EventState>(loadState);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY + ":me"),
  );
  const [isOrganiser, setIsOrganiser] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_KEY + ":org") === "1",
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // ── Lookups ───────────────────────────────────────────────
  const getPlayer = useCallback((id: string) => PLAYERS.find((p) => p.id === id), []);
  const getCourse = useCallback((id: string) => COURSES.find((c) => c.id === id), []);
  const teeFor = useCallback(
    (course: Course, player: Player) => course.tees.find((t) => t.gender === player.gender),
    [],
  );

  const playingHandicapFor = useCallback(
    (playerId: string, roundId: string): number | null => {
      const player = getPlayer(playerId);
      const round = state.rounds.find((r) => r.id === roundId);
      if (!player || !round || player.index == null) return null;
      const course = getCourse(round.courseId);
      if (!course) return null;
      const tee = course.tees.find((t) => t.gender === player.gender);
      if (!tee) return null;
      // Use the tee's own par (men and ladies can play different pars, e.g. Wheatley).
      return playingHandicap(player.index, tee, teePar(tee), EVENT.allowance);
    },
    [state.rounds, getPlayer, getCourse],
  );

  const cardFor = useCallback(
    (roundId: string, playerId: string): Scorecard =>
      state.scorecards[cardKey(roundId, playerId)] ?? emptyCard(roundId, playerId),
    [state.scorecards],
  );

  const groupsForRound = useCallback(
    (roundId: string) => state.teeGroups.filter((g) => g.roundId === roundId),
    [state.teeGroups],
  );
  const groupForPlayer = useCallback(
    (roundId: string, playerId: string) =>
      state.teeGroups.find((g) => g.roundId === roundId && g.playerIds.includes(playerId)),
    [state.teeGroups],
  );

  // ── Derived scoring ───────────────────────────────────────
  const holesForRoundPlayer = useCallback(
    (roundId: string, player: Player) => {
      const round = state.rounds.find((r) => r.id === roundId);
      const course = round && getCourse(round.courseId);
      return course?.tees.find((t) => t.gender === player.gender)?.holes ?? [];
    },
    [state.rounds, getCourse],
  );

  const pointsFor = useCallback(
    (roundId: string, playerId: string): number => {
      const player = getPlayer(playerId);
      const ph = playingHandicapFor(playerId, roundId);
      if (!player || ph == null) return 0;
      const holes = holesForRoundPlayer(roundId, player);
      return cardPoints(cardFor(roundId, playerId), holes, ph);
    },
    [getPlayer, playingHandicapFor, holesForRoundPlayer, cardFor],
  );

  const shotsFor = useCallback(
    (roundId: string, playerId: string) => {
      const player = getPlayer(playerId);
      const ph = playingHandicapFor(playerId, roundId);
      if (!player || ph == null) return {};
      return shotsMap(ph, holesForRoundPlayer(roundId, player));
    },
    [getPlayer, playingHandicapFor, holesForRoundPlayer],
  );

  const roundTotalsByPlayer = useCallback(
    (gender: "M" | "F"): Record<string, number[]> => {
      const field = PLAYERS.filter((p) => p.competing && p.gender === gender);
      // Only competition rounds count — the warm-up (demo) round is excluded.
      const compRounds = state.rounds.filter((r) => !r.demo);
      const result: Record<string, number[]> = {};
      for (const p of field) {
        result[p.id] = compRounds.map((r) => pointsFor(r.id, p.id));
      }
      return result;
    },
    [state.rounds, pointsFor],
  );

  const orderOfMeritFor = useCallback(
    (gender: "M" | "F") => orderOfMerit(roundTotalsByPlayer(gender), EVENT.countingRounds),
    [roundTotalsByPlayer],
  );

  const teamCup = useCallback((): TeamStandingRow[] => {
    const all = { ...roundTotalsByPlayer("M"), ...roundTotalsByPlayer("F") };
    return teamStandings(state.teams, all, EVENT.countingRounds);
  }, [state.teams, roundTotalsByPlayer]);

  // ── Actions ───────────────────────────────────────────────
  const selectPlayer = useCallback((id: string | null) => {
    setCurrentPlayerId(id);
    if (id) localStorage.setItem(STORAGE_KEY + ":me", id);
    else localStorage.removeItem(STORAGE_KEY + ":me");
  }, []);

  const loginOrganiser = useCallback((pin: string): boolean => {
    const ok = pin.trim() === ORGANISER_PIN;
    if (ok) {
      setIsOrganiser(true);
      sessionStorage.setItem(STORAGE_KEY + ":org", "1");
    }
    return ok;
  }, []);

  const logoutOrganiser = useCallback(() => {
    setIsOrganiser(false);
    sessionStorage.removeItem(STORAGE_KEY + ":org");
  }, []);

  const mutateCard = useCallback(
    (roundId: string, playerId: string, fn: (card: Scorecard) => Scorecard) => {
      setState((s) => {
        const key = cardKey(roundId, playerId);
        const current = s.scorecards[key] ?? emptyCard(roundId, playerId);
        return { ...s, scorecards: { ...s.scorecards, [key]: fn({ ...current, strokes: [...current.strokes] }) } };
      });
    },
    [],
  );

  const setStroke = useCallback(
    (roundId: string, playerId: string, hole: number, value: HoleScore) => {
      mutateCard(roundId, playerId, (card) => {
        card.strokes[hole - 1] = value;
        return card;
      });
    },
    [mutateCard],
  );

  const signCard = useCallback(
    (roundId: string, playerId: string, by: string) => {
      mutateCard(roundId, playerId, (card) => ({
        ...card,
        signedBy: by,
        signedAt: new Date().toISOString(),
      }));
    },
    [mutateCard],
  );

  const correctStroke = useCallback(
    (roundId: string, playerId: string, hole: number, value: HoleScore, by: string) => {
      mutateCard(roundId, playerId, (card) => {
        const from = card.strokes[hole - 1] ?? null;
        card.strokes[hole - 1] = value;
        card.corrections = [
          ...(card.corrections ?? []),
          { hole, from, to: value, by, at: new Date().toISOString() },
        ];
        return card;
      });
    },
    [mutateCard],
  );

  const setRoundStatus = useCallback((roundId: string, status: RoundStatus) => {
    setState((s) => ({
      ...s,
      rounds: s.rounds.map((r) => (r.id === roundId ? { ...r, status } : r)),
    }));
  }, []);

  const setSidePrize = useCallback(
    (roundId: string, competitionId: string, hole: number, winnerId: string | null) => {
      setState((s) => {
        const rest = s.sidePrizes.filter(
          (p) => !(p.roundId === roundId && p.competitionId === competitionId),
        );
        return { ...s, sidePrizes: [...rest, { roundId, competitionId, hole, winnerId }] };
      });
    },
    [],
  );

  const setGroupScorer = useCallback((groupId: string, playerId: string) => {
    setState((s) => ({
      ...s,
      teeGroups: s.teeGroups.map((g) => (g.id === groupId ? { ...g, scorerId: playerId } : g)),
    }));
  }, []);

  const setTeams = useCallback((teams: Team[]) => {
    setState((s) => ({ ...s, teams }));
  }, []);

  const addAnnouncement = useCallback((title: string, body: string, by: string) => {
    setState((s) => ({
      ...s,
      announcements: [
        { id: `a${s.announcements.length + 1}-${Date.now()}`, title, body, at: new Date().toISOString(), by },
        ...s.announcements,
      ],
    }));
  }, []);

  const resetAll = useCallback(() => setState(initialState()), []);

  const value = useMemo<EventContextValue>(
    () => ({
      event: EVENT,
      courses: COURSES,
      players: PLAYERS,
      competitions: COMPETITIONS,
      couples: COUPLES,
      lockedFourball: LOCKED_FOURBALL,
      rounds: state.rounds,
      teams: state.teams,
      teeGroups: state.teeGroups,
      sidePrizes: state.sidePrizes,
      announcements: state.announcements,
      currentPlayerId,
      isOrganiser,
      getPlayer,
      getCourse,
      teeFor,
      playingHandicapFor,
      cardFor,
      groupsForRound,
      groupForPlayer,
      pointsFor,
      shotsFor,
      orderOfMeritFor,
      teamCup,
      selectPlayer,
      loginOrganiser,
      logoutOrganiser,
      setStroke,
      signCard,
      correctStroke,
      setRoundStatus,
      setSidePrize,
      setGroupScorer,
      setTeams,
      addAnnouncement,
      resetAll,
    }),
    [
      state, currentPlayerId, isOrganiser, getPlayer, getCourse, teeFor, playingHandicapFor,
      cardFor, groupsForRound, groupForPlayer, pointsFor, shotsFor, orderOfMeritFor, teamCup,
      selectPlayer, loginOrganiser, logoutOrganiser, setStroke, signCard, correctStroke,
      setRoundStatus, setSidePrize, setGroupScorer, setTeams, addAnnouncement, resetAll,
    ],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEvent(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvent must be used within EventProvider");
  return ctx;
}
