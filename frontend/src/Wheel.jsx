import React from "react";

/**
 * The rotation drawn as a wheel: one segment per task plus a rest segment.
 * Hand-built SVG rather than a chart library, because the shape is simple and
 * shipping a charting dependency for one graphic isn't worth the bundle size.
 */
export default function Wheel({ tasks, resting, weekLabel, colors, highlightTaskId }) {
  const segments = [
    ...tasks.map((t, i) => ({
      key: `t${t.taskId}`,
      label: t.taskName,
      names: t.people,
      color: colors[i % colors.length],
      done: t.done,
      highlight: t.taskId === highlightTaskId,
    })),
    ...(resting.length
      ? [{ key: "rest", label: "Week off", names: resting, color: "var(--rest)", done: false, highlight: false }]
      : []),
  ];

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const outer = 150;
  const inner = 58;
  const n = segments.length;
  if (!n) return null;

  const point = (angle, radius) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="wheel"
      role="img"
      aria-label={`Task wheel for the week of ${weekLabel}`}
    >
      {segments.map((s, i) => {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const a1 = a0 + (2 * Math.PI) / n;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const [x0, y0] = point(a0, outer);
        const [x1, y1] = point(a1, outer);
        const [x2, y2] = point(a1, inner);
        const [x3, y3] = point(a0, inner);
        const d =
          n === 1
            ? `M ${cx} ${cy - outer} A ${outer} ${outer} 0 1 1 ${cx - 0.01} ${cy - outer} L ${cx - 0.01} ${cy - inner} A ${inner} ${inner} 0 1 0 ${cx} ${cy - inner} Z`
            : `M ${x0} ${y0} A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`;
        const mid = (a0 + a1) / 2;
        const [tx, ty] = point(mid, (outer + inner) / 2 + 4);
        const isRest = s.key === "rest";

        return (
          <g key={s.key}>
            <path
              d={d}
              fill={s.color}
              stroke={s.highlight ? "var(--ink)" : "var(--card)"}
              strokeWidth={s.highlight ? 4 : 3}
              opacity={s.done ? 0.45 : 1}
            />
            <text
              x={tx}
              y={ty - 4}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill={isRest ? "var(--ink)" : "#16212C"}
            >
              {`${s.done ? "✓ " : ""}${s.names.length ? shorten(s.names.join(", "), 12) : "Nobody"}`}
            </text>
            <text
              x={tx}
              y={ty + 12}
              textAnchor="middle"
              fontSize="10"
              fill={isRest ? "var(--muted)" : "#16212C"}
            >
              {shorten(s.label, 15)}
            </text>
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={inner - 6} fill="var(--card)" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
        Week of
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--ink)">
        {weekLabel}
      </text>
    </svg>
  );
}
