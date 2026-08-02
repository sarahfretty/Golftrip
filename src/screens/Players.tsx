import { useNavigate } from "react-router-dom";
import { useEvent } from "../store/store";

// "Tap your name" — no accounts, no passwords. Choosing an identity just personalises
// the app (your card, your shots, your group). Organisers additionally sign in on /admin.
export function Players() {
  const { players, currentPlayerId, selectPlayer } = useEvent();
  const navigate = useNavigate();

  const choose = (id: string) => {
    selectPlayer(id);
    navigate("/");
  };

  const golfers = players.filter((p) => p.competing);
  const attendees = players.filter((p) => !p.competing);

  return (
    <div className="screen">
      <header className="hd">
        <div className="kicker">The Belek Cup 2026</div>
        <div className="h1">Tap your name</div>
        <div className="sub">No passwords. Just you.</div>
      </header>

      <div className="sec"><div className="sec-label">Golfers</div></div>
      <div className="rows">
        {golfers.map((p) => (
          <button key={p.id} className="row" onClick={() => choose(p.id)} aria-pressed={p.id === currentPlayerId}>
            <div>
              <div className="pname">{p.name}</div>
              <div className="phcp">{p.fullName}{p.organiser ? " · Organiser" : ""}</div>
            </div>
            <span className="phcp">{p.gender === "F" ? "Red" : "Yellow"} · {p.index}</span>
          </button>
        ))}
      </div>

      <div className="sec"><div className="sec-label">Attendees</div></div>
      <div className="rows">
        {attendees.map((p) => (
          <button key={p.id} className="row" onClick={() => choose(p.id)} aria-pressed={p.id === currentPlayerId}>
            <div className="pname">{p.name}</div>
            <span className="phcp">Not competing</span>
          </button>
        ))}
      </div>

      <div className="prose">
        <button className="btn-ghost" style={{ width: "100%" }} onClick={() => navigate("/admin")}>
          Organiser sign-in
        </button>
      </div>
    </div>
  );
}
