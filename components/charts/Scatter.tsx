"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { faint, line as lineColor, muted } from "@/lib/theme";

export interface ScatterPoint {
  id: string;
  name: string;
  position: string;
  x: number;
  y: number;
  overall: number;
  highlight?: string;
}

export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xDomain = [0, 99],
  yDomain = [0, 99],
  height = 380,
  highlightIds = [],
  onSelect,
  color = "var(--color-a)",
  highlightColor = "var(--color-b)",
  trend = true,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  height?: number;
  highlightIds?: string[];
  onSelect?: (id: string) => void;
  color?: string;
  highlightColor?: string;
  trend?: boolean;
}) {
  const [hover, setHover] = useState<ScatterPoint | null>(null);
  const padding = { top: 16, right: 16, bottom: 38, left: 46 };
  const width = 560;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const sx = (v: number) => padding.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerW;
  const sy = (v: number) => padding.top + innerH - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerH;

  const trendLine = useMemo(() => {
    if (!trend || points.length < 3) return null;
    const n = points.length;
    const mx = points.reduce((a, p) => a + p.x, 0) / n;
    const my = points.reduce((a, p) => a + p.y, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
      num += (p.x - mx) * (p.y - my);
      den += (p.x - mx) ** 2;
    }
    if (den === 0) return null;
    const slope = num / den;
    const intercept = my - slope * mx;
    return { slope, intercept, r: correlation(points) };
  }, [points, trend]);

  const xTicks = ticks(xDomain[0], xDomain[1], 5);
  const yTicks = ticks(yDomain[0], yDomain[1], 5);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        <defs>
          <radialGradient id="dot-glow">
            <stop offset="0%" stopColor={highlightColor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={highlightColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={padding.left} x2={width - padding.right} y1={sy(t)} y2={sy(t)} stroke={lineColor} strokeWidth={0.6} />
            <text x={padding.left - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill={faint} className="num">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line y1={padding.top} y2={padding.top + innerH} x1={sx(t)} x2={sx(t)} stroke={lineColor} strokeWidth={0.6} />
            <text x={sx(t)} y={height - 16} textAnchor="middle" fontSize={9} fill={faint} className="num">
              {t}
            </text>
          </g>
        ))}

        {trendLine && (
          <motion.line
            x1={sx(xDomain[0])}
            y1={sy(trendLine.intercept + trendLine.slope * xDomain[0])}
            x2={sx(xDomain[1])}
            y2={sy(trendLine.intercept + trendLine.slope * xDomain[1])}
            stroke={muted}
            strokeWidth={1}
            strokeDasharray="3 5"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 0.75 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {points.map((p, i) => {
          const isHighlight = highlightIds.includes(p.id) || p.highlight;
          const r = isHighlight ? 5.5 : 3;
          return (
            <motion.circle
              key={p.id}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={r}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: isHighlight ? 1 : 0.42, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.004, 0.8) }}
              fill={isHighlight ? highlightColor : color}
              stroke={isHighlight ? "#06070a" : "none"}
              strokeWidth={isHighlight ? 1.5 : 0}
              style={{ cursor: onSelect ? "pointer" : "default" }}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(p.id)}
            />
          );
        })}

        {highlightIds.length > 0 &&
          highlightIds.map((id) => {
            const p = points.find((q) => q.id === id);
            if (!p) return null;
            return (
              <motion.circle
                key={`ring-${id}`}
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={12}
                fill="none"
                stroke={highlightColor}
                strokeWidth={1}
                initial={{ opacity: 0.8, scale: 0.6 }}
                animate={{ opacity: [0.8, 0, 0.8], scale: [0.6, 1.5, 0.6] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
                style={{ transformOrigin: `${sx(p.x)}px ${sy(p.y)}px` }}
              />
            );
          })}

        <text
          x={padding.left + innerW / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize={9.5}
          fill={faint}
          letterSpacing="0.12em"
          className="uppercase"
        >
          {xLabel}
        </text>
        <text
          transform={`translate(11 ${padding.top + innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={9.5}
          fill={faint}
          letterSpacing="0.12em"
          className="uppercase"
        >
          {yLabel}
        </text>
      </svg>

      {trendLine && (
        <p className="absolute right-0 top-0 num text-[10px]" style={{ color: faint }}>
          r = {trendLine.r.toFixed(3)}
        </p>
      )}

      {hover && (
        <div
          className="panel pointer-events-none absolute z-20 px-3 py-2"
          style={{
            left: `${(sx(hover.x) / width) * 100}%`,
            top: `${(sy(hover.y) / height) * 100}%`,
            transform: "translate(-50%, -140%)",
          }}
        >
          <p className="text-[11px] font-semibold text-ink">{hover.name}</p>
          <p className="num text-[10px] text-muted">
            {hover.position} · OVR {hover.overall} · {xLabel} {hover.x} · {yLabel} {hover.y}
          </p>
        </div>
      )}
    </div>
  );
}

function correlation(points: ScatterPoint[]): number {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    dx += (p.x - mx) ** 2;
    dy += (p.y - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

function ticks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + step * i));
}
