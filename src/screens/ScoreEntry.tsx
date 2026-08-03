import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEvent } from "../store/store";
import { holePoints, cardGross, formatGross, isCardComplete } from "../domain/scoring";
import type { HoleScore } from "../domain/types";

// Score options mirror the paper card: gross strokes only, no arithmetic. "8+" caps the
// button grid (an exact high number can be corrected by an organiser); "X" is a no return.
const OPTIONS: { label: string; value: HoleScore }[] = [
  { label: "2", value: 2 }, { label: "3", value: 3 }, { label: "4", value: 4 },
  { label: "5", value: 5 }, { label: "6", value: 6 }, { label: "7", value: 7 },
  { label: "8+", value: 8 },
];

export function ScoreEntry() {
  const { roundId = "" } = useParams();
  const ev = useEvent();
  const navigate = useNavigate();
  const [hole, setHole] = useState(1);
  const [review, setReview] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const round = ev.rounds.find((r) => r.id === roundId);
  const course = round && ev.getCourse(round.courseId);
  const me = ev.currentPlayerId ? ev.getPlayer(ev.currentPlayerId) : undefined;
  const isDemo = !!round?.demo;
  const roundGroups = round ? ev.groupsForRound(round.id) : [];
  const myGroup = me && round ? ev.groupForPlayer(round.id, me.id) : undefined;
  // Warm-up rounds are open to anyone and let you score any group; real rounds are
  // restricted to each group's nominated scorer.
  const group = isDemo
    ? roundGroups.find((g) => g.id === selectedGroupId) ?? myGroup ?? roundGroups[0]
    : myGroup;

  if (!round || !course) return <Gate title="Round not found" body="This round doesn't exist." />;
  if (round.status === "locked" || round.status === "declared")
    return <Gate title="Round closed" body="This round's results are final. See the organiser to reopen it." />;
  if (!isDemo) {
    if (!me) return <Gate title="Who are you?" body="Tap your name first, then your group's card." cta="/me" ctaLabel="Tap your name" />;
    if (!myGroup) return <Gate title="Not in a group" body={`${me.name} isn't in a group for this round.`} />;
    if (myGroup.scorerId !== me.id)
      return <Gate title={`${ev.getPlayer(myGroup.scorerId)?.name} is scoring`} body={`Only the nominated scorer enters ${myGroup.name}'s card. You can watch the standings once cards are in.`} />;
  }
  if (!group) return <Gate title="No groups yet" body="This round has no tee groups." />;

  const holeMeta = course.tees[0].holes.find((h) => h.number === hole)!;
  const groupPlayers = group.playerIds.map((id) => ev.getPlayer(id)!).filter(Boolean);
  const allComplete = group.playerIds.every((pid) => isCardComplete(ev.cardFor(round.id, pid)));

  if (review) {
    return (
      <Review
        roundId={round.id}
        groupId={group.id}
        onBack={() => setReview(false)}
        onSigned={() => navigate("/")}
      />
    );
  }

  return (
    <div className="screen">
      <header className="hd">
        <div className="kicker">{isDemo ? "Warm-up" : `Round ${round.number}`} · {course.name} · {group.name}</div>
        <div className="spread" style={{ marginTop: 7 }}>
          <div className="h1" style={{ margin: 0, fontSize: 22 }}>{isDemo ? "Demo scoring" : "You are scoring"}</div>
          <div className="phcp" style={{ color: "var(--gold-500)" }}>{me?.name ?? "Anyone can score"}</div>
        </div>
        {isDemo && roundGroups.length > 1 && (
          <div className="score-grid" style={{ gridTemplateColumns: `repeat(${roundGroups.length},1fr)`, marginTop: 12 }}>
            {roundGroups.map((g) => (
              <button
                key={g.id}
                className={`sbtn${g.id === group.id ? " selected" : ""}`}
                style={{ minHeight: 36, fontSize: 11 }}
                onClick={() => { setSelectedGroupId(g.id); setHole(1); setReview(false); }}
              >
                {g.name.replace("Group ", "G")}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Hole strip */}
      <div className="holestrip">
        {course.tees[0].holes.map((h) => {
          const done = group.playerIds.every((pid) => {
            const s = ev.cardFor(round.id, pid).strokes[h.number - 1];
            return s !== null && s !== undefined;
          });
          return (
            <button
              key={h.number}
              className={`hcell${h.number === hole ? " current" : done ? " done" : ""}`}
              onClick={() => setHole(h.number)}
              aria-label={`Hole ${h.number}${done ? ", complete" : ""}`}
            >
              {h.number}
            </button>
          );
        })}
      </div>

      {/* Hole header */}
      <div className="row row-strong">
        <div className="spread" style={{ gap: 11 }}>
          <span className="phcp" style={{ color: "var(--teal-500)" }}>Hole</span>
          <span className="stat-big" style={{ fontSize: 36 }}>{hole}</span>
        </div>
        <span className="phcp" style={{ color: "var(--charcoal)" }}>Par {holeMeta.par} · SI {holeMeta.strokeIndex} · {holeMeta.distance}{course.distanceUnit}</span>
      </div>

      {/* Per-player entry */}
      <div className="grow">
        {groupPlayers.map((p) => {
          const shots = ev.shotsFor(round.id, p.id)[hole] ?? 0;
          const stroke = ev.cardFor(round.id, p.id).strokes[hole - 1] ?? null;
          const pts = holePoints(stroke, holeMeta.par, shots);
          return (
            <div key={p.id} className="prow" style={{ padding: "12px 16px 14px", borderBottom: "1px solid var(--color-hairline)" }}>
              <div className="spread" style={{ marginBottom: 9 }}>
                <div className="spread" style={{ gap: 9, justifyContent: "flex-start" }}>
                  <span className="pname">{p.name}</span>
                  <span className="dots" aria-label={`${shots} shots`}>
                    {Array.from({ length: shots }, (_, i) => <span key={i} className="dot" />)}
                  </span>
                  <span className="phcp">{ev.playingHandicapFor(p.id, round.id)}</span>
                </div>
                <span className={`pts${stroke === null ? " pts-muted" : ""}`}>{stroke === null ? "—" : `${pts} pt${pts === 1 ? "" : "s"}`}</span>
              </div>
              <div className="score-grid" role="group" aria-label={`${p.name} score for hole ${hole}`}>
                {OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    className={`sbtn${stroke === o.value ? " selected" : ""}`}
                    onClick={() => ev.setStroke(round.id, p.id, hole, stroke === o.value ? null : o.value)}
                  >
                    {o.label}
                  </button>
                ))}
                <button
                  className={`sbtn x${stroke === "X" ? " selected" : ""}`}
                  onClick={() => ev.setStroke(round.id, p.id, hole, stroke === "X" ? null : "X")}
                  aria-label="No return"
                >
                  X
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="actionbar">
        <div className="spread" style={{ marginBottom: 11 }}>
          <span className="phcp">Saved · nothing lost if you close this</span>
        </div>
        {hole < 18 ? (
          <button className="btn" onClick={() => setHole(hole + 1)}>
            <span>Hole {hole + 1}</span><span aria-hidden>→</span>
          </button>
        ) : (
          <button className="btn btn-gold" disabled={!allComplete} onClick={() => setReview(true)}>
            <span>{allComplete ? "Check and sign" : "Finish all cards to sign"}</span><span aria-hidden>→</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Review({ roundId, groupId, onBack, onSigned }: { roundId: string; groupId: string; onBack: () => void; onSigned: () => void }) {
  const ev = useEvent();
  const round = ev.rounds.find((r) => r.id === roundId)!;
  const course = ev.getCourse(round.courseId)!;
  const group = ev.teeGroups.find((g) => g.id === groupId)!;
  const scorer = ev.getPlayer(group.scorerId)!;

  const sign = () => {
    for (const pid of group.playerIds) ev.signCard(round.id, pid, scorer.id);
    if (round.status === "upcoming") ev.setRoundStatus(round.id, "scoring");
    onSigned();
  };

  return (
    <div className="screen">
      <header className="hd">
        <div className="kicker">Round {round.number} · {course.name} · {group.name}</div>
        <div className="h1" style={{ fontSize: 26 }}>Check and sign</div>
        <div className="sub">18 of 18 holes entered</div>
      </header>

      <table className="table">
        <thead><tr><th>Player</th><th className="num">Gross</th><th className="num">Points</th></tr></thead>
        <tbody>
          {group.playerIds.map((pid) => {
            const p = ev.getPlayer(pid)!;
            const gross = cardGross(ev.cardFor(round.id, pid));
            return (
              <tr key={pid}>
                <td>{p.name}<div className="phcp">Playing handicap {ev.playingHandicapFor(pid, round.id)}</div></td>
                <td className="num" style={{ color: "var(--teal-300)" }}>{formatGross(gross)}</td>
                <td className="num"><strong style={{ fontSize: 18 }}>{ev.pointsFor(round.id, pid)}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="prose" style={{ color: "var(--teal-300)", fontSize: 12 }}>
        Signing records {scorer.name}'s name and the time against every score above. Organisers can
        correct a card afterwards; the change is always shown.
      </div>

      <div className="actionbar">
        <div className="stack">
          <button className="btn btn-gold" onClick={sign}>
            <span>Sign and submit — {scorer.name}</span><span aria-hidden>→</span>
          </button>
          <button className="btn-ghost" onClick={onBack}>Back to the card</button>
        </div>
      </div>
    </div>
  );
}

function Gate({ title, body, cta, ctaLabel }: { title: string; body: string; cta?: string; ctaLabel?: string }) {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <header className="hd">
        <div className="kicker">Score entry</div>
        <div className="h1" style={{ fontSize: 26 }}>{title}</div>
      </header>
      <div className="prose">{body}</div>
      <div className="prose">
        <button className="btn-ghost" onClick={() => navigate(cta ?? "/")}>{ctaLabel ?? "Back to home"}</button>
      </div>
    </div>
  );
}
