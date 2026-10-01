"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import type { Player } from "@/lib/dataset";
import { USE_FACES } from "@/lib/info";
import { formatValue, heightLabel, stars } from "@/lib/selectors";
import { ratingColor, series } from "@/lib/theme";
import { GK_BY_SHORT, GK_SHORTS, GROUP_SHORTS, type GroupShort } from "@/lib/types";

export type CardAccent = "a" | "b" | "neutral";

const ACCENT: Record<CardAccent, string> = {
  a: "var(--color-a)",
  b: "var(--color-b)",
  neutral: "#7c8798",
};

function glow(value: number): string {
  return ratingColor(value);
}

/**
 * Real portraits, proxied through /api/face/[id] because the source CDN blocks
 * hotlinked requests. When they are unavailable (or disabled via
 * NEXT_PUBLIC_USE_FACES=false) the procedural silhouette below stands in,
 * driven by the player's own attributes.
 */
function Portrait({
  player,
  accent,
  size = 120,
}: {
  player: Player;
  accent: string;
  /** CDN asset size. 240 is sharper but only published for some players. */
  size?: 60 | 120 | 240;
}) {
  // 0 = requested size, 1 = fall back to the universally published 120, 2 = silhouette.
  const [stage, setStage] = useState(0);
  const a = player.attributes;
  const shoulder = 44 + ((a.strength + a.jumping) / 2 / 99) * 28;
  const lean = ((a.agility - a.strength) / 99) * 6;
  const aura = 0.18 + (player.overall / 99) * 0.42;
  const uid = player.id;

  const wantSize = size > 120 && stage === 0 ? size : 120;
  const src = wantSize === 120 ? player.faceUrl : `${player.faceUrl}?s=${wantSize}`;

  if (USE_FACES && player.faceUrl && stage < 2) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt={player.displayName}
        loading="lazy"
        onError={() => setStage((s) => s + 1)}
        className="absolute inset-0 h-full w-full object-contain object-bottom opacity-95"
        style={{
          maskImage: "linear-gradient(to bottom, #000 78%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 78%, transparent 100%)",
        }}
      />
    );
  }

  return (
    <svg viewBox="0 0 200 210" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax meet">
      <defs>
        <radialGradient id={`aura-${uid}`} cx="50%" cy="40%">
          <stop offset="0%" stopColor={accent} stopOpacity={aura} />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="86" rx="92" ry="92" fill={`url(#aura-${uid})`} />
      <motion.g
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <path
          d={`M ${100 - shoulder} 210 C ${100 - shoulder - 2} 152, ${100 - 26} 140, ${100 - 15} 130
              L ${100 + 15} 130 C ${100 + 26} 140, ${100 + shoulder + 2} 152, ${100 + shoulder} 210 Z`}
          fill={`url(#body-${uid})`}
        />
        <ellipse cx={100 + lean * 0.4} cy="100" rx="24" ry="27" fill={`url(#body-${uid})`} />
      </motion.g>
    </svg>
  );
}

export function PlayerCard({
  player,
  accent = "neutral",
  href,
  index = 0,
  compact = false,
}: {
  player: Player;
  accent?: CardAccent;
  href?: string;
  index?: number;
  compact?: boolean;
}) {
  const color = ACCENT[accent];
  const overallGlow = glow(player.overall);

  const body = (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.035, 0.35), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-panel to-graphite"
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ boxShadow: `0 0 0 1px ${color}55, 0 20px 60px -22px ${color}66` }}
      />

      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <motion.p
            className="num font-bold leading-none"
            style={{ fontSize: 44, color: overallGlow, textShadow: `0 0 30px ${overallGlow}3a` }}
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            {player.overall}
          </motion.p>
          <p className="label-xs mt-1.5">{player.position}</p>
        </div>
        <div className="text-right">
          <p className="label-xs">{player.nationality}</p>
          <p className="mt-0.5 max-w-[120px] truncate text-[10px] text-faint">{player.club}</p>
        </div>
      </header>

      <div className="relative mt-1 h-[152px] w-full overflow-hidden">
        <Portrait player={player} accent={color} />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
          style={{ background: "linear-gradient(to top, rgba(8,10,15,0.95), transparent)" }}
        />
        <div className="absolute right-3 bottom-2 left-3 flex items-center justify-between">
          <span className="num text-[10px] text-faint">
            {player.age} · {heightLabel(player.heightCm)} · {player.foot}F
          </span>
          {player.potential > player.overall && (
            <span className="num rounded border border-b/25 bg-b/10 px-1.5 py-0.5 text-[9px] font-bold text-b">
              POT {player.potential}
            </span>
          )}
        </div>
      </div>

      <div className="relative px-4 pt-1 pb-4">
        <h3 className="truncate text-[14px] leading-tight font-semibold tracking-tight text-ink">
          {player.displayName}
        </h3>
        <p className="num mt-1 text-[10px] text-faint">
          {formatValue(player.valueEur)} · {stars(player.skillMoves)} · {player.weakFoot}★ weak
        </p>

        {player.hasGroupRatings ? (
          <>
            <div className="mt-3.5 grid grid-cols-3 gap-x-3 gap-y-2 border-t border-line-soft pt-3">
              {GROUP_SHORTS.map((key, gi) => (
                <div key={key} className="flex items-baseline justify-between gap-1">
                  <span className="label-xs">{key}</span>
                  <motion.span
                    className="num text-[12px] font-bold"
                    initial={{ opacity: 0, x: 4 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + gi * 0.06, duration: 0.4 }}
                    style={{ color: player.groups[key] >= 85 ? "#eaf6fa" : player.groups[key] >= 70 ? "#a8b2c1" : "#6b7482" }}
                  >
                    {player.groups[key]}
                  </motion.span>
                </div>
              ))}
            </div>

            {!compact && (
              <div className="mt-3 flex h-[3px] gap-px overflow-hidden rounded-full">
                {GROUP_SHORTS.map((key) => (
                  <div
                    key={key}
                    className="h-full"
                    style={{
                      flex: Math.max(1, player.groups[key]),
                      background: series[groupToSeries(key)],
                      opacity: 0.55,
                    }}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-3.5 grid grid-cols-3 gap-x-3 gap-y-2 border-t border-line-soft pt-3">
            {GK_SHORTS.map((key) => (
              <span key={key} className="flex items-baseline justify-between gap-1">
                <span className="label-xs">{key}</span>
                <span className="num text-[12px] font-bold text-muted">
                  {player.attributes[GK_BY_SHORT[key]]}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
    </motion.article>
  );

  return href ? (
    <Link href={href} className="block" aria-label={player.displayName}>
      {body}
    </Link>
  ) : (
    body
  );
}

export function groupToSeries(short: GroupShort): keyof typeof series {
  return ({ PAC: "pace", SHO: "shooting", PAS: "passing", DRI: "dribbling", DEF: "defending", PHY: "physical" } as const)[short];
}

export { Portrait };
