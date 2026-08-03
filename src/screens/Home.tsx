import { useNavigate } from "react-router-dom";
import { useEvent } from "../store/store";
import { Shield } from "../components/Shield";
import { cardGross, formatGross } from "../domain/scoring";
import { daysUntil, formatKicker } from "../lib/format";

// Home always answers "what is happening now". It has three shapes, chosen by the state
// of the rounds: the pre-trip cover, the round-day single job, and the sealed evening.
export function Home() {
  const ev = useEvent();
  const navigate = useNavigate();
  const me = ev.currentPlayerId ? ev.getPlayer(ev.currentPlayerId) : undefined;

  // Focus round: the one being scored or sealed, else the next upcoming by date.
  const active = ev.rounds.find((r) => !r.demo && (r.status === "scoring" || r.status === "sealed"));
  const upcoming = [...ev.rounds]
    .filter((r) => r.status === "upcoming" && !r.demo)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const focus = active ?? upcoming ?? ev.rounds[ev.rounds.length - 1];
  const focusCourse = focus && ev.getCourse(focus.courseId);

  const days = daysUntil(ev.event.startDate);

  return (
    <div className="screen">
      <header className="hd">
        <div className="hd-row">
          <div>
            <div className="kicker">Belek · Turkey</div>
            <div className="h1" style={{ marginTop: 6 }}>The Belek Cup<br />2026</div>
            <div className="sub">7–14 September · sixteen of us</div>
          </div>
          <Shield size={56} />
        </div>
      </header>

      {/* Identity bar */}
      <button className="row row-strong" onClick={() => navigate("/me")}>
        {me ? (
          <>
            <div>
              <div className="pname">{me.name}</div>
              <div className="phcp">{me.competing ? `Index ${me.index} · ${me.gender === "F" ? "Red" : "Yellow"} tees` : "Attendee"}</div>
            </div>
            <span className="phcp">Change →</span>
          </>
        ) : (
          <>
            <div className="pname">Tap your name to begin</div>
            <span className="phcp">Set me →</span>
          </>
        )}
      </button>

      {/* Warm-up: always reachable, so the whole scoring flow can be demoed before the trip. */}
      {(() => {
        const demo = ev.rounds.find((r) => r.demo);
        if (!demo || demo.status === "declared" || demo.status === "locked") return null;
        const c = ev.getCourse(demo.courseId);
        return (
          <div style={{ padding: "14px 16px", borderBottom: "2px solid var(--color-divider)" }}>
            <button
              className="btn btn-gold"
              onClick={() => {
                if (demo.status !== "scoring") ev.setRoundStatus(demo.id, "scoring");
                navigate(`/score/${demo.id}`);
              }}
            >
              <span>Try scoring · {c?.name} warm-up</span><span aria-hidden>→</span>
            </button>
          </div>
        );
      })()}

      {focus?.status === "scoring" ? (
        <RoundDay />
      ) : focus?.status === "sealed" ? (
        <SealedEvening />
      ) : (
        <PreTrip days={days} />
      )}

      {/* The rounds, always available */}
      <div className="sec"><div className="sec-label">The rounds</div></div>
      <div className="rows">
        {ev.rounds.map((r) => {
          const c = ev.getCourse(r.courseId);
          return (
            <div key={r.id} className="row">
              <div>
                <div className="pname">{c?.name}</div>
                <div className="phcp">{r.demo ? "Warm-up round" : `Round ${r.number} · ${formatKicker(r.date)}`}</div>
              </div>
              <span className="tag">{r.status}</span>
            </div>
          );
        })}
      </div>

      {focusCourse && focus?.status !== "upcoming" && (
        <div className="note">No positions until every card is in. Play golf.</div>
      )}
    </div>
  );
}

function PreTrip({ days }: { days: number }) {
  const ev = useEvent();
  const me = ev.currentPlayerId ? ev.getPlayer(ev.currentPlayerId) : undefined;
  const f = ev.event.flights.out;

  return (
    <>
      <div className="row row-strong">
        <div>
          <div className="phcp" style={{ color: "var(--teal-500)" }}>We fly in</div>
          <div className="stat-big" style={{ marginTop: 6 }}>{days > 0 ? `${days} days` : "This week"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="pname">{f.from} → {f.to}</div>
          <div className="phcp">{formatKicker(f.date)} · {f.depart}</div>
        </div>
      </div>

      {me?.competing && (
        <>
          <div className="sec"><div className="sec-label">Your shots</div></div>
          <div className="rows">
            {ev.rounds.map((r) => {
              const ph = ev.playingHandicapFor(me.id, r.id);
              const c = ev.getCourse(r.courseId);
              return (
                <div key={r.id} className="row">
                  <div>
                    <div className="pname">{c?.name}</div>
                    <div className="phcp">{r.demo ? "Warm-up" : `Round ${r.number}`}</div>
                  </div>
                  <span className="stat-big" style={{ fontSize: 22 }}>{ph}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="prose">
        <div className="sec-label" style={{ marginBottom: 8 }}>The format, once</div>
        Individual Stableford, three rounds, {Math.round(ev.event.allowance * 100)}% of your course handicap.
        Best {ev.event.countingRounds} of 3 count. Nearest the pin and longest drive each round.
      </div>
      <div className="note">Nothing to enter yet. We'll wake up when you land.</div>
    </>
  );
}

function RoundDay() {
  const ev = useEvent();
  const navigate = useNavigate();
  const round = ev.rounds.find((r) => !r.demo && r.status === "scoring")!;
  const course = ev.getCourse(round.courseId);
  const me = ev.currentPlayerId ? ev.getPlayer(ev.currentPlayerId) : undefined;
  const group = me ? ev.groupForPlayer(round.id, me.id) : undefined;
  const isScorer = group && me && group.scorerId === me.id;
  const ph = me ? ev.playingHandicapFor(me.id, round.id) : null;

  return (
    <>
      <div className="row row-strong">
        <div>
          <div className="phcp" style={{ color: "var(--teal-500)" }}>Round {round.number} · {course?.name}</div>
          <div className="stat-big" style={{ marginTop: 6 }}>{ph ?? "—"} <span className="phcp">shots today</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="phcp">Tee</div>
          <div className="pname">{round.teeWindow}</div>
        </div>
      </div>

      {group && (
        <>
          <div className="sec"><div className="sec-label">Your group · {group.name}</div></div>
          <div className="rows">
            {group.playerIds.map((pid) => {
              const p = ev.getPlayer(pid);
              return (
                <div key={pid} className="row">
                  <div className="spread" style={{ gap: 9 }}>
                    <span className="pname">{p?.name}</span>
                    {group.scorerId === pid && <span className="tag tag-solid">Scoring</span>}
                  </div>
                  <span className="phcp">{ev.playingHandicapFor(pid, round.id)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="actionbar">
        {isScorer ? (
          <button className="btn" onClick={() => navigate(`/score/${round.id}`)}>
            <span>Start scoring · {group?.name}</span><span aria-hidden>→</span>
          </button>
        ) : group ? (
          <div className="banner" style={{ margin: 0 }}>{ev.getPlayer(group.scorerId)?.name} is scoring for {group.name}. Enjoy your round.</div>
        ) : (
          <button className="btn-ghost" onClick={() => navigate("/me")}>Tap your name to see your group</button>
        )}
      </div>
    </>
  );
}

function SealedEvening() {
  const ev = useEvent();
  const round = ev.rounds.find((r) => r.status === "sealed")!;
  const course = ev.getCourse(round.courseId);
  const me = ev.currentPlayerId ? ev.getPlayer(ev.currentPlayerId) : undefined;
  const myCard = me ? ev.cardFor(round.id, me.id) : undefined;
  const myPoints = me ? ev.pointsFor(round.id, me.id) : 0;
  const gross = myCard ? cardGross(myCard) : undefined;

  return (
    <>
      <div className="banner banner-gold">
        <strong>Round {round.number} sealed.</strong> {course?.name} is complete, but standings stay
        sealed until the ceremony. Your own card is yours to see — nobody else's.
      </div>
      {me?.competing && gross && (
        <div className="row row-strong">
          <div>
            <div className="phcp" style={{ color: "var(--teal-500)" }}>Your card</div>
            <div className="stat-big" style={{ marginTop: 6 }}>{myPoints} <span className="phcp">points · {formatGross(gross)} gross</span></div>
          </div>
          <Shield size={48} />
        </div>
      )}
    </>
  );
}
