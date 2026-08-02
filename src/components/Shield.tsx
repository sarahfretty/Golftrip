// The Belek Cup crest. `won` fills the shield gold — the promise kept, used once in
// Ceremony Mode. Otherwise it's outlined gold: the Cup is still unwon.

export function Shield({ size = 56, won = false }: { size?: number; won?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="The Belek Cup 2026 crest"
      style={{ flex: "none" }}
    >
      <path
        d="M28 12 H72 V58 C72 74 60 83 50 88 C40 83 28 74 28 58 Z"
        fill={won ? "var(--gold-600)" : "none"}
        stroke="var(--gold-600)"
        strokeWidth="2.6"
      />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        style={{
          fontFamily: "'Bodoni Moda', serif",
          fontWeight: 400,
          fontStyle: "italic",
          fontSize: "34px",
        }}
        fill={won ? "var(--charcoal)" : "var(--glass)"}
      >
        Bc
      </text>
    </svg>
  );
}
