import React from "react";
import { pretty } from "../lib/dates";

export interface Point { date: string; value: number }

/** A minimal line chart that draws itself in. Dates are spaced by time. */
const LineChart: React.FC<{ points: Point[]; unit: string; color?: string }> = ({ points, unit, color = "#ececec" }) => {
  const width = 320;
  const height = 150;
  const pad = { top: 16, right: 12, bottom: 22, left: 12 };

  if (points.length === 0) {
    return <div className="h-[150px] flex items-center justify-center text-sm text-mute">No entries yet</div>;
  }

  const times = points.map(p => new Date(p.date).getTime());
  const values = points.map(p => p.value);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const spread = Math.max(...values) - Math.min(...values);
  const vMin = Math.min(...values) - (spread || 1) * 0.15;
  const vMax = Math.max(...values) + (spread || 1) * 0.15;

  const x = (t: number) => pad.left + (tMax === tMin ? 0.5 : (t - tMin) / (tMax - tMin)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - vMin) / (vMax - vMin)) * (height - pad.top - pad.bottom);
  const coords = points.map((p, i) => [x(times[i]), y(p.value)] as const);
  const path = coords.map(([cx, cy], i) => `${i === 0 ? "M" : "L"}${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
  const area = `${path} L${coords[coords.length - 1][0].toFixed(1)},${height - pad.bottom} L${coords[0][0].toFixed(1)},${height - pad.bottom} Z`;
  const gradientId = `fill-${unit}`;
  // Keying on the data replays the draw-in whenever it changes.
  const key = points.map(p => `${p.date}:${p.value}`).join("|");

  return (
    <svg key={key} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#2c2c2c" />
      <path d={area} fill={`url(#${gradientId})`} className="anim-fade-up" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
        className="draw-line"
      />
      {coords.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === coords.length - 1 ? 3.5 : 2} fill={i === coords.length - 1 ? color : "#0c0c0c"} stroke={color} strokeWidth="1.2" />
      ))}
      <text x={pad.left} y={height - 6} fill="#8b8b8b" fontSize="9">{pretty(points[0].date, "d MMM")}</text>
      {points.length > 1 && (
        <text x={width - pad.right} y={height - 6} fill="#8b8b8b" fontSize="9" textAnchor="end">
          {pretty(points[points.length - 1].date, "d MMM")}
        </text>
      )}
    </svg>
  );
};

export default LineChart;
