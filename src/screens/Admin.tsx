import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEvent } from "../store/store";
import { validateTeams, cardGross, formatGross } from "../domain/scoring";
import type { HoleScore, RoundStatus, Team } from "../domain/types";

// Organiser console. In this local adapter, access is a shared PIN; in production this is
// a Supabase Auth login (see docs/AUTH). Every correction is written to the card's audit
// trail with the organiser's name and time — the only thing that makes the board trusted.
export function Admin() {
  const ev = useEvent();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  if (!ev.isOrganiser) {
    return (
      <div className="screen">
        <header className="hd">
          <div className="kicker">Organisers only</div>
          <div className="h1" style={{ fontSize: 26 }}>Sign in</div>
          <div className="sub">Jane &amp; Sarah</div>
        </header>
        <div className="prose stack">
          <div>
            <label className="label" htmlFor="pin">Organiser PIN</label>
            <input
              id="pin"
              className="input"
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setErr(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              autoComplete="off"
            />
          </div>
          {err && <div style={{ color: "var(--color-danger)", fontSize: 14 }}>Wrong PIN. Try again.</div>}
          <button className="btn" onClick={submit}><span>Sign in</span><span aria-hidden>→</span></button>
          <button className="btn-ghost" onClick={() => navigate("/")}>Back</button>
        </div>
      </div>
    );

    function submit() {
      if (ev.loginOrganiser(pin)) navigate("/admin");
      else setErr(true);
    }
  }

  return (
    <div className="screen">
      <header className="hd">
        <div className="spread">
          <div>
            <div className="kicker">Organiser</div>
            <div className="h1" style={{ fontSize: 26 }}>Console</div>
          </div>
          <button className="phcp" style={{ background: "none", border: "none", color: "var(--teal-200)" }} onClick={() => { ev.logoutOrganiser(); navigate("/"); }}>Sign out</button>
        </div>
      </header>

      <RoundsControl />
      <TeamsControl />
      <SidePrizesControl />
      <CorrectionControl />
      <AnnouncementControl />

      <div className="prose">
        <button className="btn-ghost" style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
          onClick={() => { if (confirm("Reset ALL event data (cards, standings, teams)? This cannot be undone.")) ev.resetAll(); }}>
          Reset all event data
        </button>
      </div>
    </div>
  );
}

const NEXT_STATUS: { label: string; status: RoundStatus }[] = [
  { label: "Scoring", status: "scoring" },
  { label: "Declare", status: "declared" },
  { label: "Seal", status: "sealed" },
  { label: "Lock", status: "locked" },
  { label: "Reopen", status: "upcoming" },
];

function RoundsControl() {
  const ev = useEvent();
  return (
    <>
      <div className="sec"><div className="sec-label">Rounds — publish &amp; lock</div></div>
      <div className="rows">
        {ev.rounds.map((r) => {
          const c = ev.getCourse(r.courseId);
          const submitted = ev.groupsForRound(r.id).filter((g) =>
            g.playerIds.every((pid) => ev.cardFor(r.id, pid).signedAt)).length;
          const groups = ev.groupsForRound(r.id).length;
          return (
            <div key={r.id} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
              <div className="spread">
                <div>
                  <div className="pname">{c?.name}</div>
                  <div className="phcp">Round {r.number} · {submitted}/{groups} cards in</div>
                </div>
                <span className="tag">{r.status}</span>
              </div>
              <div className="score-grid" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
                {NEXT_STATUS.map((s) => (
                  <button
                    key={s.status}
                    className={`sbtn${r.status === s.status ? " selected" : ""}`}
                    style={{ fontSize: 10, minHeight: 40 }}
                    onClick={() => ev.setRoundStatus(r.id, s.status)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function TeamsControl() {
  const ev = useEvent();
  const competing = ev.players.filter((p) => p.competing);
  const teamOf = (pid: string) => ev.teams.find((t) => t.playerIds.includes(pid))?.id;

  const assign = (pid: string, teamId: string | null) => {
    const next: Team[] = ev.teams.map((t) => ({ ...t, playerIds: t.playerIds.filter((id) => id !== pid) }));
    if (teamId) next.find((t) => t.id === teamId)!.playerIds.push(pid);
    ev.setTeams(next);
  };

  const warnings = validateTeams(ev.teams, ev.couples, ev.lockedFourball);

  return (
    <>
      <div className="sec"><div className="sec-label">Teams — two of seven</div></div>
      {warnings.map((w, i) => <div key={i} className="banner" style={{ margin: "0 16px 8px", borderLeftColor: "var(--gold-600)" }}>{w}</div>)}
      <div className="rows">
        {competing.map((p) => {
          const t = teamOf(p.id);
          return (
            <div key={p.id} className="row">
              <div className="spread" style={{ gap: 8, justifyContent: "flex-start" }}>
                <span className="pname">{p.name}</span>
                {p.lockedGroup && <span className="tag">4B</span>}
              </div>
              <div className="score-grid" style={{ gridTemplateColumns: "repeat(3,44px)", width: "auto" }}>
                {ev.teams.map((team) => (
                  <button key={team.id} className={`sbtn${t === team.id ? " selected" : ""}`} style={{ minHeight: 38, fontSize: 12 }}
                    onClick={() => assign(p.id, t === team.id ? null : team.id)}>
                    {team.name.replace("Team ", "")}
                  </button>
                ))}
                <button className={`sbtn${!t ? " selected" : ""}`} style={{ minHeight: 38, fontSize: 12 }} onClick={() => assign(p.id, null)}>—</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SidePrizesControl() {
  const ev = useEvent();
  const prizes = ev.competitions.filter((c) => c.type === "nearest-the-pin" || c.type === "longest-drive");
  return (
    <>
      <div className="sec"><div className="sec-label">Side prizes — one each per round</div></div>
      <div className="rows">
        {ev.rounds.map((r) =>
          prizes.map((c) => {
            const sp = ev.sidePrizes.find((s) => s.roundId === r.id && s.competitionId === c.id);
            return (
              <div key={r.id + c.id} className="row">
                <div>
                  <div className="pname">{c.name}</div>
                  <div className="phcp">Round {r.number}</div>
                </div>
                <select
                  className="input"
                  style={{ width: 150, minHeight: 40 }}
                  value={sp?.winnerId ?? ""}
                  onChange={(e) => ev.setSidePrize(r.id, c.id, sp?.hole ?? 0, e.target.value || null)}
                >
                  <option value="">— winner —</option>
                  {ev.players.filter((p) => p.competing).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            );
          }),
        )}
      </div>
    </>
  );
}

function CorrectionControl() {
  const ev = useEvent();
  const [roundId, setRoundId] = useState(ev.rounds[0].id);
  const [playerId, setPlayerId] = useState("");
  const [hole, setHole] = useState(1);
  const [value, setValue] = useState("");

  const round = ev.rounds.find((r) => r.id === roundId)!;
  const players = ev.groupsForRound(roundId).flatMap((g) => g.playerIds);
  const actorId = ev.currentPlayerId && ev.getPlayer(ev.currentPlayerId)?.organiser ? ev.currentPlayerId : "sarah";
  const card = playerId ? ev.cardFor(roundId, playerId) : undefined;

  const apply = () => {
    if (!playerId || value === "") return;
    const v: HoleScore = value === "X" ? "X" : Number(value);
    ev.correctStroke(roundId, playerId, hole, v, actorId);
    setValue("");
  };

  return (
    <>
      <div className="sec"><div className="sec-label">Correct a card — shown in the audit trail</div></div>
      <div className="prose stack">
        <div className="spread" style={{ gap: 8 }}>
          <select className="input" value={roundId} onChange={(e) => { setRoundId(e.target.value); setPlayerId(""); }}>
            {ev.rounds.map((r) => <option key={r.id} value={r.id}>R{r.number} {ev.getCourse(r.courseId)?.name}</option>)}
          </select>
          <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">— player —</option>
            {players.map((pid) => <option key={pid} value={pid}>{ev.getPlayer(pid)?.name}</option>)}
          </select>
        </div>
        <div className="spread" style={{ gap: 8 }}>
          <select className="input" value={hole} onChange={(e) => setHole(Number(e.target.value))}>
            {Array.from({ length: 18 }, (_, i) => <option key={i + 1} value={i + 1}>Hole {i + 1}{card ? ` (now ${card.strokes[i] ?? "—"})` : ""}</option>)}
          </select>
          <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">— new —</option>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "X"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button className="btn" disabled={!playerId || value === ""} onClick={apply}><span>Apply correction</span><span aria-hidden>→</span></button>
        {card && (card.corrections?.length ?? 0) > 0 && (
          <div style={{ fontSize: 13, color: "var(--teal-300)" }}>
            {card.corrections!.map((c, i) => (
              <div key={i}>Hole {c.hole}: {String(c.from ?? "—")} → {String(c.to)} by {ev.getPlayer(c.by)?.name}</div>
            ))}
          </div>
        )}
        {playerId && card && (
          <div className="phcp">Card gross {formatGross(cardGross(card))} · {ev.pointsFor(roundId, playerId)} pts · {round.status}</div>
        )}
      </div>
    </>
  );
}

function AnnouncementControl() {
  const ev = useEvent();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const actorId = ev.currentPlayerId && ev.getPlayer(ev.currentPlayerId)?.organiser ? ev.currentPlayerId : "sarah";

  const post = () => {
    if (!title.trim()) return;
    ev.addAnnouncement(title.trim(), body.trim(), actorId);
    setTitle(""); setBody("");
  };

  return (
    <>
      <div className="sec"><div className="sec-label">Announcement — to everyone</div></div>
      <div className="prose stack">
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" style={{ minHeight: 80, padding: 12 }} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn" disabled={!title.trim()} onClick={post}><span>Post announcement</span><span aria-hidden>→</span></button>
      </div>
    </>
  );
}
