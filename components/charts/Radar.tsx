"use client";

import { motion } from "framer-motion";
import { useId, useMemo, useState } from "react";
import { GROUP_SHORTS, type GroupShort } from "@/lib/types";

export interface RadarSeries {
  id: string;
  label: string;
  color: string;
  values: Record<GroupShort, number> | number[];
}

const AXES: GroupShort[] = [...GROUP_SHORTS];

/** Normalise either shape into axis order. */
function valuesOf(values: RadarSeries["values"]): number[] {
  if (Array.isArray(values)) return values;
  return AXES.map((a) => values[a]);
}

function pointAt(angle: number, radius: number) {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
}

function polygonPath(radiusFor: (index: number) => number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  return (
    AXES.map((_, i) => {
      const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
      const r = radiusFor(i);
      const [x, y] = pointAt(angle, r);
      return `${i === 0 ? "M" : "L"}${(cx + x).toFixed(2)},${(cy + y).toFixed(2)}`;
    }).join(" ") + " Z"
  );
}

export function RadarChart({
  series,
  size = 380,
  min = 20,
  max = 99,
  domain = "group",
  labels,
  showValues = true,
  className = "",
}: {
  series: RadarSeries[];
  size?: number;
  min?: number;
  max?: number;
  domain?: "group" | "attribute";
  labels?: string[];
  showValues?: boolean;
  className?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const axes = domain === "group" ? AXES : (labels ?? []).map((_, i) => `x${i}` as GroupShort);
  const count = domain === "group" ? 6 : axes.length;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - (domain === "group" ? 40 : 16);

  const scale = (value: number) => {
    const t = (value - min) / (max - min);
    return Math.max(0, Math.min(1, t)) * maxRadius;
  };

  const rings = useMemo(() => [0.25, 0.5, 0.75, 1], []);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          {series.map((s) => (
            <radialGradient key={s.id} id={`${gradientId}-${s.id}`}>
              <stop offset="0%" stopColor={s.color} stopOpacity="0.34" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.06" />
            </radialGradient>
          ))}
        </defs>

        {/* rings */}
        {rings.map((ring) => (
          <path
            key={ring}
            d={polygonPath(() => maxRadius * ring, size)}
            fill="none"
            stroke="#1a1f29"
            strokeWidth={ring === 1 ? 1 : 0.75}
          />
        ))}

        {/* spokes */}
        {Array.from({ length: count }, (_, i) => {
          const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
          const [x, y] = pointAt(angle, maxRadius);
          return (
            <motion.line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + x}
              y2={cy + y}
              stroke={hover === i ? "#39414f" : "#1a1f29"}
              strokeWidth={0.75}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.04 }}
            />
          );
        })}

        {/* hover wedge */}
        {hover !== null && (
          <path
            d={(() => {
              const angle = (Math.PI * 2 * hover) / count - Math.PI / 2;
              const half = Math.PI / count;
              const [x1, y1] = pointAt(angle - half, maxRadius);
              const [x2, y2] = pointAt(angle + half, maxRadius);
              return `M${cx},${cy} L${cx + x1},${cy + y1} A${maxRadius},${maxRadius} 0 0 1 ${cx + x2},${cy + y2} Z`;
            })()}
            fill="#ffffff"
            opacity={0.028}
          />
        )}

        {/* series */}
        {series.map((s, si) => {
          const values = valuesOf(s.values);
          return (
            <motion.path
              key={s.id}
              d={polygonPath((i) => scale(values[i]), size)}
              fill={`url(#${gradientId}-${s.id})`}
              stroke={s.color}
              strokeWidth={1.6}
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.82 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.15 + si * 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
          );
        })}

        {/* vertices + axis hit targets */}
        {Array.from({ length: count }, (_, i) => {
          const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
          const [lx, ly] = pointAt(angle, maxRadius + (domain === "group" ? 20 : 10));
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "crosshair" }}
            >
              <circle cx={cx + lx} cy={cy + ly} r={16} fill="transparent" />
              <text
                x={cx + lx}
                y={cy + ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="num"
                fontSize={9.5}
                letterSpacing="0.14em"
                fill={hover === i ? "#f2f5f9" : "#5b6474"}
                style={{ fontWeight: 600, pointerEvents: "none" }}
              >
                {domain === "group" ? AXES[i] : (labels?.[i] ?? "").toUpperCase().slice(0, 4)}
              </text>
              {showValues &&
                hover === i &&
                domain === "group" &&
                series.map((s) => {
                  const [vx, vy] = pointAt(angle, scale(valuesOf(s.values)[i]));
                  return (
                    <text
                      key={s.id}
                      x={cx + vx}
                      y={cy + vy - 8}
                      textAnchor="middle"
                      className="num"
                      fontSize={11}
                      fontWeight={700}
                      fill={s.color}
                    >
                      {valuesOf(s.values)[i]}
                    </text>
                  );
                })}
            </g>
          );
        })}
      </svg>

      {/* legend */}
      {series.length > 1 && (
        <div className="absolute inset-x-0 -bottom-1 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
          {series.map((s) => (
            <span key={s.id} className="label-xs flex items-center gap-1.5" style={{ color: "#8a94a6" }}>
              <span className="h-[2px] w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
