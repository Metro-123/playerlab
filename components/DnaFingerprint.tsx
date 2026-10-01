"use client";

import { motion } from "framer-motion";
import { useId, useMemo, useState } from "react";
import { GROUP_SHORTS, type GroupShort } from "@/lib/types";

const AXES = [...GROUP_SHORTS];

export interface DnaProfile {
  id: string;
  name: string;
  position: string;
  color: string;
  values: Record<GroupShort, number>;
}

/**
 * Attribute DNA: a closed blob whose radius on each of six axes is a group
 * rating, with an inner "core" polygon whose radius encodes how balanced the
 * profile is (deviation from the player's own mean). Asymmetric, repeatable
 * shapes make players instantly distinguishable.
 */
export function DnaFingerprint({
  profile,
  size = 220,
  showRing = true,
  className = "",
}: {
  profile: DnaProfile;
  size?: number;
  showRing?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  const [hover, setHover] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 26;

  const nodes = useMemo(
    () =>
      AXES.map((key, i) => {
        const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
        const t = (profile.values[key] - 25) / 74;
        const r = Math.max(0.18, Math.min(1, t)) * maxR;
        return { key, angle, r, value: profile.values[key], x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
      }),
    [profile.values, maxR, cx, cy],
  );

  const mean = AXES.reduce((a, k) => a + profile.values[k], 0) / AXES.length;
  const core = useMemo(
    () =>
      AXES.map((_, i) => {
        const n = nodes[i];
        const pull = n.r * (0.34 + 0.3 * (1 - Math.abs(n.value - mean) / 40));
        return {
          x: cx + Math.cos(n.angle) * Math.max(4, pull),
          y: cy + Math.sin(n.angle) * Math.max(4, pull),
        };
      }),
    [nodes, mean, cx, cy],
  );

  const outline = nodes.map((n, i) => `${i === 0 ? "M" : "L"}${n.x.toFixed(2)},${n.y.toFixed(2)}`).join(" ") + " Z";
  const corePath = core.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + " Z";

  // A second, slower-rotating polygon gives the shape a sense of depth.
  const inner = nodes.map((n, i) => {
    const r = n.r * 0.72;
    const angle = n.angle + 0.22;
    return `${i === 0 ? "M" : "L"}${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`;
  }).join(" ") + " Z";

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <radialGradient id={`dna-${uid}`}>
            <stop offset="0%" stopColor={profile.color} stopOpacity="0.42" />
            <stop offset="70%" stopColor={profile.color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={profile.color} stopOpacity="0.03" />
          </radialGradient>
        </defs>

        {showRing && (
          <>
            <circle cx={cx} cy={cy} r={maxR} fill="none" stroke="#1a1f29" strokeWidth={0.7} />
            <circle cx={cx} cy={cy} r={maxR * 0.5} fill="none" stroke="#161b24" strokeWidth={0.7} />
          </>
        )}

        {AXES.map((key, i) => {
          const n = nodes[i];
          return (
            <line
              key={key}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(n.angle) * maxR}
              y2={cy + Math.sin(n.angle) * maxR}
              stroke={hover === i ? profile.color : "#1a1f29"}
              strokeWidth={hover === i ? 1 : 0.6}
              opacity={0.7}
            />
          );
        })}

        <motion.path
          d={inner}
          fill="none"
          stroke={profile.color}
          strokeWidth={0.8}
          strokeDasharray="2 4"
          opacity={0.4}
          initial={{ opacity: 0, rotate: -14 }}
          whileInView={{ opacity: 0.45, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        <motion.path
          d={corePath}
          fill={profile.color}
          opacity={0.5}
          initial={{ scale: 0.2, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.5 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        <motion.path
          d={outline}
          fill={`url(#dna-${uid})`}
          stroke={profile.color}
          strokeWidth={1.7}
          strokeLinejoin="round"
          initial={{ scale: 0.55, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          onMouseLeave={() => setHover(null)}
        />

        {nodes.map((n, i) => (
          <g key={n.key} onMouseEnter={() => setHover(i)}>
            <circle cx={n.x} cy={n.y} r={11} fill="transparent" />
            <motion.circle
              cx={n.x}
              cy={n.y}
              r={hover === i ? 4.6 : 2.8}
              fill={profile.color}
              stroke="#06070a"
              strokeWidth={1}
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + i * 0.06, duration: 0.3 }}
            />
            {hover === i && (
              <text
                x={n.x}
                y={n.y - 12}
                textAnchor="middle"
                fontSize={10}
                className="num"
                fontWeight={700}
                fill="#f2f5f9"
              >
                {n.value}
              </text>
            )}
          </g>
        ))}

        <circle cx={cx} cy={cy} r={2} fill={profile.color} />
      </svg>
    </div>
  );
}

/** Side-by-side DNA comparison with a similarity score. */
export function DnaCompare({ a, b, size = 190 }: { a: DnaProfile; b: DnaProfile; size?: number }) {
  const distance = Math.sqrt(
    GROUP_SHORTS.reduce((sum, key) => sum + (a.values[key] - b.values[key]) ** 2, 0),
  );
  const similarity = Math.max(0, Math.min(100, Math.round(100 - (distance / Math.sqrt(6) / 74) * 100)));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <figure className="flex flex-col items-center gap-2">
        <DnaFingerprint profile={a} size={size} />
        <figcaption className="text-center">
          <p className="text-[12px] font-semibold text-ink">{a.name}</p>
          <p className="label-xs">{a.position}</p>
        </figcaption>
      </figure>

      <div className="flex flex-col items-center gap-2">
        <div className="flex h-24 w-px flex-col items-center justify-between" style={{ background: "#1a1f29" }}>
          <span className="text-[9px] tracking-[0.2em] text-faint">VS</span>
        </div>
        <div className="text-center">
          <p className="num text-[26px] leading-none font-bold" style={{ color: similarity > 70 ? "var(--color-b)" : "var(--color-a)" }}>
            {similarity}%
          </p>
          <p className="label-xs mt-1">shape match</p>
        </div>
      </div>

      <figure className="flex flex-col items-center gap-2">
        <DnaFingerprint profile={b} size={size} />
        <figcaption className="text-center">
          <p className="text-[12px] font-semibold text-ink">{b.name}</p>
          <p className="label-xs">{b.position}</p>
        </figcaption>
      </figure>
    </div>
  );
}
