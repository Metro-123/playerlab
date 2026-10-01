"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { deltaColor, faint, line, muted } from "@/lib/theme";
import { signed } from "@/lib/format";

export interface DeltaRow {
  key: string;
  label: string;
  a: number;
  b: number;
  /** Optional per-point model impact, shown as a tooltip. */
  impact?: number;
}

/**
 * Diverging horizontal bars. The zero line sits at the midpoint so A-only
 * advantages extend left and B-only advantages extend right.
 */
export function DeltaBars({
  rows,
  aLabel = "A",
  bLabel = "B",
  colorA = "var(--color-a)",
  colorB = "var(--color-b)",
  min = 0,
  max = 99,
  compact = false,
}: {
  rows: DeltaRow[];
  aLabel?: string;
  bLabel?: string;
  colorA?: string;
  colorB?: string;
  min?: number;
  max?: number;
  compact?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const height = compact ? 34 : 44;

  return (
    <div className="w-full">
      <div
        className="relative mb-3 grid items-center gap-3 border-b border-line-soft pb-2"
        style={{ gridTemplateColumns: compact ? "76px 1fr 1fr 52px" : "124px 1fr 1fr 62px" }}
      >
        <span className="label-xs">Attribute</span>
        <span className="label-xs text-right" style={{ color: colorA }}>
          {aLabel}
        </span>
        <span className="label-xs" style={{ color: colorB }}>
          {bLabel}
        </span>
        <span className="label-xs text-right">Δ</span>
      </div>

      <ul>
        {rows.map((row, i) => {
          const delta = row.a - row.b;
          const winner = Math.abs(delta) < 1 ? "tie" : delta > 0 ? "a" : "b";
          const barColor = winner === "a" ? colorA : winner === "b" ? colorB : muted;
          const span = max - min;
          const width = (Math.abs(delta) / span) * 100;
          return (
            <li
              key={row.key}
              onMouseEnter={() => setHover(row.key)}
              onMouseLeave={() => setHover(null)}
              className="grid items-center gap-3 border-b border-line-soft/60 transition-colors"
              style={{
                gridTemplateColumns: compact ? "76px 1fr 1fr 52px" : "124px 1fr 1fr 62px",
                height,
                background: hover === row.key ? "rgba(255,255,255,0.018)" : "transparent",
              }}
            >
              <span
                className="truncate text-[11px] font-medium"
                style={{ color: hover === row.key ? "#f2f5f9" : "#8a94a6" }}
                title={row.impact !== undefined ? `${row.impact >= 0 ? "+" : ""}${row.impact.toFixed(3)} overall per point` : undefined}
              >
                {row.label}
              </span>

              <div className="flex justify-end">
                <motion.span
                  className="num text-[13px] font-semibold"
                  style={{ color: row.a >= 85 ? "#e8f7fb" : "#8a94a6" }}
                  initial={{ opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.012, 0.4) }}
                >
                  {row.a}
                </motion.span>
              </div>

              <div className="num text-[13px] font-semibold" style={{ color: row.b >= 85 ? "#eafbcb" : "#8a94a6" }}>
                {row.b}
              </div>

              <div className="flex items-center justify-end gap-2">
                <div className="relative h-[3px] w-14 overflow-hidden rounded-full bg-[#141821]">
                  <motion.div
                    className="absolute top-0 h-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${Math.min(width, 100)}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: Math.min(i * 0.012, 0.5), ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      background: barColor,
                      left: winner === "b" ? 0 : `${100 - Math.min(width, 100)}%`,
                      boxShadow: `0 0 8px ${barColor}66`,
                    }}
                  />
                </div>
                <span
                  className="num w-9 text-right text-[11px] font-bold tabular-nums"
                  style={{ color: deltaColor(delta) }}
                >
                  {delta === 0 ? "—" : signed(delta, 0)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between text-[10px]" style={{ color: faint }}>
        <span>scale {min}–{max}</span>
        <span>bar length = |Δ| in rating points</span>
      </div>
    </div>
  );
}

/** Single-player horizontal attribute list with a percentile ghost track. */
export function AttributeRows({
  rows,
  color = "var(--color-a)",
  showPercentile = true,
}: {
  rows: Array<{ key: string; label: string; value: number; percentile?: number }>;
  color?: string;
  showPercentile?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <ul className="w-full">
      {rows.map((row, i) => (
        <li
          key={row.key}
          onMouseEnter={() => setHover(row.key)}
          onMouseLeave={() => setHover(null)}
          className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line-soft/50 py-2.5"
          style={{ background: hover === row.key ? "rgba(255,255,255,0.02)" : "transparent" }}
        >
          <div className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-[11px] font-medium text-muted" style={{ color: hover === row.key ? "#f2f5f9" : undefined }}>
                {row.label}
              </span>
              {showPercentile && row.percentile !== undefined && (
                <span className="num text-[9.5px]" style={{ color: faint }}>
                  p{row.percentile}
                </span>
              )}
            </div>
            <div className="relative h-[5px] w-full overflow-hidden rounded-full bg-[#12161e]">
              {showPercentile && row.percentile !== undefined && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${row.percentile}%`, background: "#1b2029" }}
                />
              )}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={{ width: 0 }}
                whileInView={{ width: `${(row.value / 99) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.85, delay: Math.min(i * 0.02, 0.5), ease: [0.16, 1, 0.3, 1] }}
                style={{ background: color, boxShadow: `0 0 10px ${color}50` }}
              />
            </div>
          </div>
          <span className="num text-[15px] font-semibold text-ink" style={{ minWidth: 30, textAlign: "right" }}>
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export { line as lineColor };
