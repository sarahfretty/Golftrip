import type { ReactNode } from "react";
import { useEvent } from "../store/store";
import { Shield } from "../components/Shield";
import { orderOfMerit, teamStandings } from "../domain/scoring";
import type { Player } from "../domain/types";

// The Cup shows standings from DECLARED rounds only. A sealed round contributes nothing
// to what is displayed until an organiser declares it — anticipation without false info.
export function Cup() {
  const ev = useEvent();
  const compRounds = ev.rounds.filter((r) => !r.demo);
  const declared = compRounds.filter((r) => r.status === "declared" || r.status === "locked");
  const sealed = compRounds.filter((r) => r.status === "sealed");

  const totalsFor = (field: Player[]) => {
    const t: Record<string, number[]> = {};
    for (const p of field) t[p.id] = declared.map((r) => ev.pointsFor(r.id, p.id));
    return t;
  };

  const ladies = ev.players.filter((p) => p.competing && p.gender === "F");
  const men = ev.players.filter((p) => p.competing && p.gender === "M");
  const n = ev.event.countingRounds;

  const ladiesOoM = orderOfMerit(totalsFor(ladies), n);
  const mensOoM = orderOfMerit(totalsFor(men), n);
  const allTotals = { ...totalsFor(ladies), ...totalsFor(men) };
  const teamsPicked = ev.teams.some((t) => t.playerIds.length > 0);
  const teamCup = teamsPicked ? teamStandings(ev.teams, allTotals, n) : [];

  return (
    <div className="screen">
      <header className="hd">
        <div className="hd-row">
          <div>
            <div className="kicker">Standings</div>
            <div className="h1">The Cup</div>
            <div className="sub">{declared.length} of {compRounds.length} rounds declared</div>
          </div>
          <Shield size={48} />
        </div>
      </header>

      <WarmUp />

      {declared.length === 0 ? (
        <div className="center-col grow">
          <Shield size={72} />
          <p className="display-italic" style={{ fontSize: 18, color: "var(--teal-700)", maxWidth: "24ch" }}>
            No standings until the first round is declared. Nobody knows anything yet.
          </p>
        </div>
      ) : (
        <>
          {sealed.length > 0 && (
            <div className="banner banner-gold">
              Round{sealed.length > 1 ? "s" : ""} {sealed.map((r) => r.number).join(", ")} sealed until the
              ceremony — not shown here.
            </div>
          )}

          <Board title="The Team Cup">
            {!teamsPicked ? (
              <div className="prose">Teams not yet picked. The organiser assigns two teams of seven — the
                fourball split 2-2, couples split — and the Team Cup appears here.</div>
            ) : (
              <table className="table">
                <thead><tr><th>#</th><th>Team</th><th className="num">Points</th></tr></thead>
                <tbody>
                  {teamCup.map((row, i) => (
                    <tr key={row.teamId}>
                      <td>{i + 1}</td>
                      <td>{ev.teams.find((t) => t.id === row.teamId)?.name}</td>
                      <td className="num"><strong>{row.total}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Board>

          <Board title="Ladies' Champion · Order of Merit">
            <StandingsTable rows={ladiesOoM} declaredCount={declared.length} />
          </Board>

          <Board title="Men's Champion · Order of Merit">
            <StandingsTable rows={mensOoM} declaredCount={declared.length} />
          </Board>

          <SidePrizes />
        </>
      )}
    </div>
  );
}

// The warm-up (demo) round gets its own single-round leaderboard, shown once declared —
// so the full flow (enter → sign → declare → standings) can be demoed without touching the Cup.
function WarmUp() {
  const ev = useEvent();
  const demo = ev.rounds.find((r) => r.demo && (r.status === "declared" || r.status === "locked"));
  if (!demo) return null;
  const course = ev.getCourse(demo.courseId);
  const rows = ev.players
    .filter((p) => p.competing)
    .map((p) => ({ p, pts: ev.pointsFor(demo.id, p.id), played: ev.cardFor(demo.id, p.id).strokes.some((s) => s !== null) }))
    .filter((r) => r.played)
    .sort((a, b) => b.pts - a.pts);
  if (rows.length === 0) return null;
  return (
    <>
      <div className="banner banner-gold">Warm-up · {course?.name} — a practice round, not part of the Cup.</div>
      <div className="sec"><div className="sec-label">Warm-up leaderboard · {course?.name}</div></div>
      <table className="table">
        <thead><tr><th>#</th><th>Player</th><th className="num">Points</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.p.id}><td>{i + 1}</td><td>{r.p.name}</td><td className="num"><strong>{r.pts}</strong></td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Board({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="sec"><div className="sec-label">{title}</div></div>
      {children}
    </>
  );
}

function StandingsTable({
  rows,
  declaredCount,
}: {
  rows: { playerId: string; roundTotals: number[]; total: number }[];
  declaredCount: number;
}) {
  const ev = useEvent();
  return (
    <table className="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          {Array.from({ length: declaredCount }, (_, i) => <th key={i} className="num">R{i + 1}</th>)}
          <th className="num">Best {Math.min(ev.event.countingRounds, declaredCount)}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.playerId}>
            <td>{i + 1}</td>
            <td>{ev.getPlayer(row.playerId)?.name}</td>
            {row.roundTotals.map((v, j) => <td key={j} className="num">{v}</td>)}
            <td className="num"><strong>{row.total}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SidePrizes() {
  const ev = useEvent();
  const declared = ev.rounds.filter((r) => r.status === "declared" || r.status === "locked");
  const prizes = ev.competitions.filter((c) => c.type === "nearest-the-pin" || c.type === "longest-drive");
  const rows = declared.flatMap((r) =>
    prizes.map((c) => {
      const sp = ev.sidePrizes.find((s) => s.roundId === r.id && s.competitionId === c.id);
      return { round: r, comp: c, winner: sp?.winnerId ? ev.getPlayer(sp.winnerId) : null };
    }),
  );
  if (rows.length === 0) return null;
  return (
    <Board title="Side prizes">
      <div className="rows">
        {rows.map(({ round, comp, winner }) => (
          <div key={round.id + comp.id} className="row">
            <div>
              <div className="pname">{winner ? winner.name : "—"}</div>
              <div className="phcp">{comp.name} · Round {round.number}</div>
            </div>
          </div>
        ))}
      </div>
    </Board>
  );
}
