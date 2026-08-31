import { useEvent } from "../store/store";
import { formatShortDate, formatKicker, formatTime } from "../lib/format";

// The shared timeline: itinerary, travel, hotel, teams, groups and announcements.
// One layer for everyone — no personal schedule.
export function Trip() {
  const ev = useEvent();
  const { flights, hotel } = ev.event;
  const rounds = ev.rounds;

  return (
    <div className="screen">
      <header className="hd">
        <div className="kicker">7–14 September</div>
        <div className="h1">The trip</div>
        <div className="sub">Seven nights, three rounds</div>
      </header>

      {ev.announcements.length > 0 && (
        <>
          <div className="sec"><div className="sec-label">Announcements</div></div>
          <div className="rows">
            {ev.announcements.map((a) => (
              <div key={a.id} className="row" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="pname">{a.title}</div>
                  <div className="prose" style={{ padding: "4px 0 0", fontSize: 14 }}>{a.body}</div>
                  <div className="phcp" style={{ marginTop: 4 }}>{ev.getPlayer(a.by)?.name} · {formatTime(a.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec"><div className="sec-label">Itinerary</div></div>
      <div className="rows">
        {rounds.map((r) => {
          const c = ev.getCourse(r.courseId);
          return (
            <div key={r.id} className="row">
              <div>
                <div className="pname">{c?.name}</div>
                <div className="phcp">Round {r.number} · {r.teeWindow}</div>
              </div>
              <span className="phcp">{formatShortDate(r.date)}</span>
            </div>
          );
        })}
        <div className="row row-strong">
          <div>
            <div className="pname">The ceremony</div>
            <div className="phcp">Driven reveal · the finale</div>
          </div>
          <span className="phcp">{formatShortDate(ev.event.ceremonyDate)}</span>
        </div>
      </div>

      <div className="sec"><div className="sec-label">Travel</div></div>
      <div className="rows">
        <div className="row">
          <div>
            <div className="pname">{flights.out.from} → {flights.out.to}</div>
            <div className="phcp">{flights.out.carrier} {flights.out.flightNo} · {formatKicker(flights.out.date)} · {flights.out.duration}</div>
          </div>
          <span className="pname">{flights.out.depart}</span>
        </div>
        <div className="row">
          <div>
            <div className="pname">{flights.back.from} → {flights.back.to}</div>
            <div className="phcp">{flights.back.carrier} {flights.back.flightNo} · {formatKicker(flights.back.date)} · {flights.back.duration}</div>
          </div>
          <span className="pname">{flights.back.depart}</span>
        </div>
        <div className="row row-strong">
          <div>
            <div className="pname">{hotel.name}</div>
            <div className="phcp">{hotel.nights} nights · {hotel.board}</div>
          </div>
        </div>
      </div>

      <div className="sec"><div className="sec-label">Teams</div></div>
      {ev.teamsRevealed ? (
        <div className="card-grid" style={{ paddingBottom: 8 }}>
          {ev.teams.map((t) => (
            <div key={t.id} className="card">
              <div className="sec-label" style={{ marginBottom: 8 }}>{t.name}</div>
              {t.playerIds.map((pid) => (
                <div key={pid} className="spread" style={{ padding: "3px 0" }}>
                  <span className="pname" style={{ fontSize: 14 }}>{ev.getPlayer(pid)?.name}</span>
                  {pid === t.captainId && <span className="tag">Captain</span>}
                </div>
              ))}
              {t.nonScoringIds.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--color-hairline)" }}>
                  {t.nonScoringIds.map((pid) => (
                    <div key={pid} className="phcp" style={{ padding: "3px 0" }}>{ev.getPlayer(pid)?.name}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="prose" style={{ paddingTop: 4 }}>
          Two teams, to be announced. All fifteen of us belong to one, and the best five cards a
          side count each round. The organisers pick the two teams and reveal them.
        </div>
      )}

      {rounds.map((r) => {
        const c = ev.getCourse(r.courseId);
        return (
          <div key={r.id}>
            <div className="sec"><div className="sec-label">Tee groups · Round {r.number} · {c?.name}</div></div>
            <div className="rows">
              {ev.groupsForRound(r.id).map((g) => (
                <div key={g.id} className="row">
                  <div>
                    <div className="pname">{g.name}</div>
                    <div className="phcp">{g.playerIds.map((pid) => ev.getPlayer(pid)?.name).join(" · ")}</div>
                  </div>
                  <span className="tag">Scorer {ev.getPlayer(g.scorerId)?.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
