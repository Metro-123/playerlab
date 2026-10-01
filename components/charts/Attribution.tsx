"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { signed } from "@/lib/format";
import { faint, series } from "@/lib/theme";

const HAIRLINE = "#1e232e";

export interface Contribution {
  key: string;
  label: string;
  group: string;
  points: number;
}

/**
 * "What drives the rating" — exact additive attribution. Bar length is the
 * number of overall-rating points that attribute contributes above the
 * position baseline, so the bars sum to (prediction − baseline).
 */
export function AttributionChart({
  contributions,
  limit = 10,
  color = "var(--color-a)",
  showResidual = true,
  baseline = 0,
  predicted,
}: {
  contributions: Contribution[];
  limit?: number;
  color?: string;
  showResidual?: boolean;
  baseline?: number;
  predicted?: number;
}) {
  const [scope, setScope] = useState<"all" | "positive">("all");
  const shown =
    scope === "positive" ? contributions.filter((c) => c.points > 0.05) : contributions;
  const rows = shown.slice(0, limit);
  const max = Math.max(...rows.map((r) => Math.abs(r.points)), 0.5);
  const visible = rows.filter((r) => Math.abs(r.points) > 0.02);
  const totalShown = visible.reduce((a, r) => a + r.points, 0);
  const omitted = contributions
    .slice(scope === "positive" ? Math.max(0, contributions.findIndex((c) => c.points <= 0.05)) : limit)
    .reduce((a, r) => a + r.points, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-[10px]" style={{ color: faint }}>
          <span>
            top {limit} of {contributions.length} attributes
          </span>
          {showResidual && (
            <span>
              shown total {signed(totalShown, 2)} pts{omitted !== 0 ? ` · rest ${signed(omitted, 2)}` : ""}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(["all", "positive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className="label-xs rounded-full border px-2.5 py-1.5 transition-all"
              style={{
                borderColor: scope === s ? "transparent" : HAIRLINE,
                background: scope === s ? "#1c222c" : "transparent",
                color: scope === s ? "#f2f5f9" : faint,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* zero line */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ background: "#1e232e" }} />

        <ul className="space-y-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((row, i) => {
              const positive = row.points >= 0;
              const width = (Math.abs(row.points) / max) * 50;
              const barColor = positive ? color : "#fb7185";
              return (
                <motion.li
                  key={row.key}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, delay: Math.min(i * 0.03, 0.3) }}
                  className="relative grid h-7 grid-cols-[1fr_auto] items-center"
                >
                  <div className="relative h-full">
                    <div className="absolute inset-y-1.5 right-1/2 left-0" style={{ width: "100%" }}>
                      <div className="relative h-full w-full">
                        <motion.div
                          className="absolute top-0 h-full rounded-[3px]"
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.75, delay: 0.1 + Math.min(i * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                          style={{
                            background: `linear-gradient(90deg, ${barColor}22, ${barColor})`,
                            borderLeft: `1px solid ${barColor}`,
                            [positive ? "left" : "right"]: "50%",
                            boxShadow: `0 0 14px ${barColor}30`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-3">
                    <span className="w-32 truncate text-[10.5px] font-medium" style={{ color: "#8a94a6" }}>
                      {row.label}
                    </span>
                    <span
                      className="num w-11 text-right text-[11px] font-bold"
                      style={{ color: Math.abs(row.points) < 0.05 ? faint : barColor }}
                    >
                      {signed(row.points, 2)}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        {predicted !== undefined && showResidual && (
          <div className="mt-5 flex items-baseline justify-between border-t border-line-soft pt-3">
            <span className="label-xs">position baseline {baseline.toFixed(1)} + attribution</span>
            <span className="num text-[15px] font-bold text-ink">{predicted.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Share-of-influence donut used on the model page. */
export function ShareBars({
  items,
  color,
}: {
  items: Array<{ label: string; share: number; group?: string }>;
  color?: string;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const barColor = color ?? (item.group ? series[item.group as keyof typeof series] : undefined) ?? "var(--color-a)";
        return (
          <li key={item.label}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[11px] font-medium text-muted">{item.label}</span>
              <span className="num text-[11px] font-bold" style={{ color: barColor }}>
                {(item.share * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-[6px] w-full overflow-hidden rounded-full bg-[#12161e]">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                whileInView={{ width: `${item.share * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: barColor, boxShadow: `0 0 12px ${barColor}44` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
