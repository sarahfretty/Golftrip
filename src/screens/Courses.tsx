import { useParams, useNavigate } from "react-router-dom";
import { useEvent } from "../store/store";

// Course guides, free from the scorecard data: par, stroke index and yardages per tee.
export function Courses() {
  const ev = useEvent();
  const { courseId } = useParams();
  const navigate = useNavigate();

  if (courseId) {
    const course = ev.getCourse(courseId);
    if (course) return <CourseGuide courseId={courseId} onBack={() => navigate("/courses")} />;
  }

  return (
    <div className="screen">
      <header className="hd">
        <div className="kicker">The rounds</div>
        <div className="h1">Courses</div>
        <div className="sub">Three cards, three days</div>
      </header>
      <div className="rows">
        {ev.rounds.map((r) => {
          const c = ev.getCourse(r.courseId);
          if (!c) return null;
          const men = c.tees.find((t) => t.gender === "M");
          const ladies = c.tees.find((t) => t.gender === "F");
          return (
            <button key={r.id} className="row" onClick={() => navigate(`/courses/${c.id}`)}>
              <div>
                <div className="pname">{c.name}</div>
                <div className="phcp">Round {r.number} · Par {c.par}</div>
              </div>
              <span className="phcp">
                {men && `${men.tee} ${men.courseRating}/${men.slope}`}
                {ladies && ` · red ${ladies.courseRating}/${ladies.slope}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CourseGuide({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const ev = useEvent();
  const course = ev.getCourse(courseId)!;
  const men = course.tees.find((t) => t.gender === "M")!;
  const ladies = course.tees.find((t) => t.gender === "F")!;
  const holes = men.holes;

  const out = holes.slice(0, 9);
  const inc = holes.slice(9);

  return (
    <div className="screen">
      <header className="hd">
        <button className="phcp" style={{ background: "none", border: "none", color: "var(--teal-200)" }} onClick={onBack}>← Courses</button>
        <div className="h1" style={{ fontSize: 26, marginTop: 8 }}>{course.name}</div>
        <div className="sub">Par {course.par} · {men.tee} {men.courseRating}/{men.slope} · red {ladies.courseRating}/{ladies.slope}</div>
      </header>

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 340 }}>
          <thead>
            <tr>
              <th>Hole</th><th className="num">Par</th><th className="num">SI</th>
              <th className="num">{men.tee} (M)</th><th className="num">Red (L)</th>
            </tr>
          </thead>
          <tbody>
            {holes.map((h, i) => (
              <tr key={h.number}>
                <td>{h.number}</td>
                <td className="num">{h.par}</td>
                <td className="num">{h.strokeIndex}</td>
                <td className="num">{h.distance}</td>
                <td className="num">{ladies.holes[i].distance}</td>
              </tr>
            ))}
            <tr>
              <td><strong>Total</strong></td>
              <td className="num"><strong>{course.par}</strong></td>
              <td className="num">—</td>
              <td className="num"><strong>{men.holes.reduce((s, h) => s + h.distance, 0)}</strong></td>
              <td className="num"><strong>{ladies.holes.reduce((s, h) => s + h.distance, 0)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="prose" style={{ color: "var(--teal-300)", fontSize: 13 }}>
        Distances in {course.distanceUnit === "m" ? "metres" : "yards"}. Men play {men.tee}; ladies play red.
        Out {out.reduce((s, h) => s + h.par, 0)} / In {inc.reduce((s, h) => s + h.par, 0)}.
      </div>
    </div>
  );
}
