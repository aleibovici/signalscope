"use client";

import { useTheme } from "next-themes";
import { useState } from "react";
import { stageLabel } from "@/lib/stage-labels";

interface SparklineProps {
  points: { score: number; stage: string; date: string }[];
  height?: number;
}

const STAGE_COLORS: Record<string, string> = {
  EARLY: "#16a34a",
  FORMING: "#ca8a04",
  CONFIRMED: "#2563eb",
  FILTERED: "#dc2626",
};

const WIDTH = 400;
const PAD_X = 20;
const PAD_Y = 14;

export function Sparkline({ points, height = 56 }: SparklineProps) {
  const { resolvedTheme } = useTheme();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const isDark = resolvedTheme === "dark";

  if (points.length === 0) return null;

  const n = points.length;
  const xStep = n > 1 ? (WIDTH - PAD_X * 2) / (n - 1) : 0;
  const yRange = height - PAD_Y * 2;

  function getX(i: number) {
    return n > 1 ? PAD_X + i * xStep : WIDTH / 2;
  }

  function getY(score: number) {
    return PAD_Y + yRange - (score / 100) * yRange;
  }

  // Smooth cubic bezier path — control points pulled 40% toward next/prev horizontally
  function buildLinePath(): string {
    if (n === 1) return "";
    const pts = points.map((p, i) => ({ x: getX(i), y: getY(p.score) }));
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const cp1x = pts[i].x + dx * 0.4;
      const cp2x = pts[i + 1].x - dx * 0.4;
      d += ` C ${cp1x},${pts[i].y} ${cp2x},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
  }

  const linePath = buildLinePath();

  // Close the path along the bottom for the area fill
  const areaPath = n > 1
    ? `${linePath} L ${getX(n - 1)},${height} L ${getX(0)},${height} Z`
    : "";

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      width="100%"
      aria-label="Score history sparkline"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="#3b82f6"
            stopOpacity={isDark ? "0.22" : "0.12"}
          />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Subtle grid lines at 25 / 50 / 75 */}
      {[25, 50, 75].map((score) => (
        <line
          key={score}
          x1={PAD_X}
          y1={getY(score)}
          x2={WIDTH - PAD_X}
          y2={getY(score)}
          stroke={isDark ? "#3f3f46" : "#f3f4f6"}
          strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      {areaPath && <path d={areaPath} fill="url(#sparkline-fill)" />}

      {/* Smooth line */}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke={isDark ? "#60a5fa" : "#93c5fd"}
          strokeWidth="0.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Dots + hit areas */}
      {points.map((p, i) => {
        const x = getX(i);
        const y = getY(p.score);
        const color = STAGE_COLORS[p.stage] ?? "#6b7280";
        const isLast = i === n - 1;
        const isHovered = hoveredIndex === i;
        const r = isLast || isHovered ? 2.5 : 1.5;
        // Anchor label so it doesn't overflow left/right edges
        const labelAnchor = x < PAD_X + 16 ? "start" : x > WIDTH - PAD_X - 16 ? "end" : "middle";

        return (
          <g key={i}>
            {/* Soft ring on active dot */}
            {(isLast || isHovered) && (
              <circle cx={x} cy={y} r={r + 2.5} fill={color} fillOpacity="0.15" />
            )}

            <circle
              cx={x}
              cy={y}
              r={r}
              fill={color}
              stroke={isDark ? "#12181f" : "white"}
              strokeWidth="1"
            />

            {/* Large invisible hit area */}
            <circle
              cx={x}
              cy={y}
              r={12}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <title>{`${p.date}: ${p.score} (${stageLabel(p.stage)})`}</title>
            </circle>

            {/* Score label above dot */}
            {(isLast || isHovered) && (
              <text
                x={x}
                y={y - r - 5}
                textAnchor={labelAnchor}
                fontSize="6.5"
                fill={color}
                fontWeight="500"
                letterSpacing="0.02em"
              >
                {p.score}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
