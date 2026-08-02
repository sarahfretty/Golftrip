import { NavLink } from "react-router-dom";

// Inline Lucide-style glyphs (stroke, currentColor) — no icon dependency.
const icons = {
  home: (
    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />
  ),
  trip: (
    <>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </>
  ),
  courses: (
    <>
      <path d="M6 3v18" />
      <path d="M6 4h11l-2.5 3.5L17 11H6" />
    </>
  ),
  cup: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 17h6M8 21h8M12 13v4" />
    </>
  ),
};

function Glyph({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

const TABS = [
  { to: "/", label: "Home", icon: "home" as const, end: true },
  { to: "/trip", label: "Trip", icon: "trip" as const },
  { to: "/courses", label: "Courses", icon: "courses" as const },
  { to: "/cup", label: "Cup", icon: "cup" as const },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? " active" : ""}`}>
          <Glyph name={t.icon} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
