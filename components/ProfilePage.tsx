"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { DatasetLoader, useDataset } from "@/components/useDataset";
import { AnimatedNumber, Chip, Label, Meter, Reveal } from "@/components/ui";
import { AttributionChart, ShareBars } from "@/components/charts/Attribution";
import { AttributeRows, DeltaBars } from "@/components/charts/Bars";
import { RadarChart, type RadarSeries } from "@/components/charts/Radar";
import { ScatterPlot } from "@/components/charts/Scatter";
import { DnaFingerprint } from "@/components/DnaFingerprint";
import { Portrait } from "@/components/PlayerCard";
import { ATTRIBUTE_GROUPS, GK_BY_SHORT, GK_SHORTS, GROUP_SHORTS, type AttributeKey } from "@/lib/types";
import { ATTRIBUTE_LABELS } from "@/lib/types";
import {
  calibration,
  groupInfluence,
  modelSummary,
  predictPlayer,
  profile,
  similarPlayers,
} from "@/lib/model";
import { percentileInPosition } from "@/lib/dataset";
import { formatValue, formatWage, heightLabel, stars } from "@/lib/selectors";
import { ratingColor, series } from "@/lib/theme";
import type { Dataset } from "@/lib/dataset";
import type { Player } from "@/lib/dataset";

const groupKey = (short: string) =>
  ({ PAC: "pace", SHO: "shooting", PAS: "passing", DRI: "dribbling", DEF: "defending", PHY: "physical" } as const)[
    short as "PAC"
  ];

export function ProfilePage({ id }: { id: string }) {
  const { dataset, progress, error } = useDataset();
  if (!dataset) return <DatasetLoader progress={progress} error={error} />;

  const numericId = Number(id);
  const player = dataset.byId.get(numericId);
  if (!player) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-ink">Player {id} is not in this dataset.</p>
        <Link href="/players" className="label-xs text-a hover:underline">
          Back to search
        </Link>
      </div>
    );
  }

  return <Profile dataset={dataset} player={player} />;
}

function Profile({ dataset, player }: { dataset: Dataset; player: Player }) {
  const [tab, setTab] = useState<"attributes" | "model" | "peers">("attributes");
  const prediction = useMemo(() => predictPlayer(player), [player]);
  const stats = useMemo(() => profile(dataset, player), [dataset, player]);
  const cal = useMemo(() => calibration(player), [player]);
  const peers = useMemo(() => similarPlayers(dataset, player, 6), [dataset, player]);
  const isGk = player.position === "GK";
  const color = ratingColor(player.overall);

  const attributeRows = useMemo(
    () =>
      (Object.keys(player.attributes) as AttributeKey[])
        .filter((key) => isGk || !["diving", "handling", "kicking", "reflexes", "positioning"].includes(key))
        .map((key) => ({
          key,
          label: ATTRIBUTE_LABELS[key],
          value: player.attributes[key],
          percentile: percentileInPosition(dataset, player, key) ?? 0,
        })),
    [dataset, player, isGk],
  );

  const gkRows = useMemo(
    () =>
      (Object.keys(player.attributes) as AttributeKey[])
        .filter((key) => ["diving", "handling", "kicking", "reflexes", "positioning"].includes(key))
        .map((key) => ({
          key,
          label: ATTRIBUTE_LABELS[key],
          value: player.attributes[key],
          percentile: percentileInPosition(dataset, player, key) ?? 0,
        })),
    [dataset, player],
  );

  const peersScatter = useMemo(
    () =>
      dataset.players
        .filter((p) => p.position === player.position && p.id !== player.id)
        .slice(0, 900)
        .map((p) => ({
          id: String(p.id),
          name: p.displayName,
          position: p.position,
          x: isGk ? p.attributes.reflexes : p.groups.PAC,
          y: isGk ? p.attributes.positioning : p.groups.SHO,
          overall: p.overall,
        })),
    [dataset, player, isGk],
  );

  return (
    <div className="pt-10">
      <Link href="/players" className="label-xs text-faint transition-colors hover:text-a">
        ← Player database
      </Link>

      {/* ---------------------------------------------------------- header */}
      <header className="panel relative mt-5 overflow-hidden">
        <div
          className="pointer-events-none absolute -right-20 -bottom-32 h-80 w-80 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: color }}
        />
        <div className="grid gap-8 p-7 lg:grid-cols-[1.15fr_auto_1fr] lg:items-center">
          <div>
            <div className="flex items-end gap-5">
              <AnimatedNumber
                value={player.overall}
                className="num text-[clamp(4rem,9vw,7rem)] leading-[0.85] font-bold"
              />
              <div className="pb-2">
                <p className="label-xs">{player.position}</p>
                <p className="num mt-1 text-[11px] text-faint">
                  potential {player.potential}
                  {player.potential > player.overall ? ` (+${player.potential - player.overall})` : ""}
                </p>
              </div>
            </div>

            <h1 className="mt-5 text-[clamp(1.5rem,3.2vw,2.3rem)] leading-tight font-semibold tracking-[-0.03em] text-ink">
              {player.displayName}
            </h1>
            <p className="num mt-1.5 text-[11px] text-faint">{player.name}</p>

            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
              {[
                ["Club", player.club],
                ["League", player.league],
                ["Nation", player.nationality],
                ["Age", String(player.age)],
                ["Height", `${heightLabel(player.heightCm)} · ${player.weightKg}kg`],
                ["Foot", `${player.foot} · ${stars(player.weakFoot)} weak`],
                ["Value", formatValue(player.valueEur)],
                ["Wage", formatWage(player.wageEur)],
                ["Skill moves", stars(player.skillMoves)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label-xs">{k}</dt>
                  <dd className="num mt-1 truncate text-[12px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {player.altPositions.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                <span className="label-xs self-center">Also</span>
                {player.altPositions.map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </div>
            )}
          </div>

          <div className="relative h-[280px] w-[240px] shrink-0 self-center">
            <Portrait player={player} accent={color} size={240} />
          </div>

          <div className="flex flex-col items-center gap-4">
            {player.hasGroupRatings ? (
              <>
                <DnaFingerprint
                  profile={{ id: String(player.id), name: player.displayName, position: player.position, color: "var(--color-a)", values: player.groups }}
                  size={216}
                />
                <div className="w-full max-w-[280px] space-y-3">
                  {GROUP_SHORTS.map((key) => (
                    <div key={key} className="grid grid-cols-[34px_1fr_28px] items-center gap-3">
                      <span className="label-xs">{key}</span>
                      <Meter value={player.groups[key]} color={series[groupKey(key)]} height={5} />
                      <span className="num text-right text-[11px] font-semibold text-ink">{player.groups[key]}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full max-w-[280px]">
                <p className="label-xs mb-3" style={{ color: series.goalkeeping }}>
                  GOALKEEPING
                </p>
                <div className="space-y-3">
                  {GK_SHORTS.map((key) => (
                    <div key={key} className="grid grid-cols-[34px_1fr_28px] items-center gap-3">
                      <span className="label-xs">{key}</span>
                      <Meter
                        value={player.attributes[GK_BY_SHORT[key]]}
                        color={series.goalkeeping}
                        height={5}
                      />
                      <span className="num text-right text-[11px] font-semibold text-ink">
                        {player.attributes[GK_BY_SHORT[key]]}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[10.5px] leading-relaxed text-faint">
                  FC 26 publishes no PAC/SHO/PAS/DRI/DEF/PHY for goalkeepers, so the six-axis fingerprint
                  does not apply here.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-line-soft px-7 py-4">
          <Link
            href={`/compare?a=${player.id}`}
            className="rounded-full bg-ink px-4 py-2 text-[10px] font-semibold tracking-[0.12em] text-void uppercase transition-transform hover:scale-[1.03]"
          >
            Set as Player A
          </Link>
          <Link
            href={`/whatif?player=${player.id}`}
            className="rounded-full border border-line px-4 py-2 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase transition-colors hover:border-a/50 hover:text-ink"
          >
            Open in What-If Lab
          </Link>
          <p className="ml-auto self-center text-[11px] text-faint">
            {stats.percentileInPosition}th percentile among {player.position}s · position median{" "}
            {stats.positionStats?.median ?? "—"}
          </p>
        </div>
      </header>

      {/* ----------------------------------------------------------- tabs */}
      <nav className="mt-12 flex gap-1 border-b border-line">
        {(
          [
            ["attributes", "Attributes"],
            ["model", "Model breakdown"],
            ["peers", "Peers & scatter"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative px-4 py-3 text-[11px] font-semibold tracking-[0.12em] uppercase transition-colors ${
              tab === key ? "text-ink" : "text-faint hover:text-muted"
            }`}
          >
            {label}
            {tab === key && (
              <motion.span layoutId="profile-tab" className="absolute inset-x-0 -bottom-px h-px bg-a" />
            )}
          </button>
        ))}
      </nav>

      <div className="mt-10">
        {tab === "attributes" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="grid gap-5 lg:grid-cols-[1.25fr_1fr]"
          >
            <div className="panel p-6">
              <p className="label-xs mb-1.5">Percentiles</p>
              <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                Against other {player.position}s
              </h2>
              <div className="space-y-8">
                {ATTRIBUTE_GROUPS.filter((g) =>
                  isGk ? g.key === "goalkeeping" : g.key !== "goalkeeping",
                ).map((group) => {
                  const rows = attributeRows.filter((r) =>
                    (group.attributes as readonly string[]).includes(r.key),
                  );
                  if (rows.length === 0) return null;
                  return (
                    <div key={group.key}>
                      <div className="mb-2 flex items-center gap-2.5">
                        <span className="h-[2px] w-4" style={{ background: series[group.key as keyof typeof series] }} />
                        <span className="label-xs" style={{ color: series[group.key as keyof typeof series] }}>
                          {group.label}
                        </span>
                      </div>
                      <AttributeRows rows={rows} color={series[group.key as keyof typeof series]} />
                    </div>
                  );
                })}
                {isGk && (
                  <div>
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className="h-[2px] w-4" style={{ background: series.goalkeeping }} />
                      <span className="label-xs" style={{ color: series.goalkeeping }}>
                        GOALKEEPING
                      </span>
                    </div>
                    <AttributeRows rows={gkRows} color={series.goalkeeping} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="panel flex justify-center p-6">
                {player.hasGroupRatings ? (
                  <RadarChart
                    size={340}
                    series={
                      [
                        {
                          id: "p",
                          label: player.displayName,
                          color: "var(--color-a)",
                          values: player.groups,
                        },
                        {
                          id: "median",
                          label: `${player.position} median`,
                          color: "#5b6474",
                          values: medianGroups(dataset, player),
                        },
                      ] satisfies RadarSeries[]
                    }
                  />
                ) : (
                  <div className="flex max-w-[280px] flex-col items-center gap-3 py-10 text-center">
                    <span className="label-xs" style={{ color: series.goalkeeping }}>
                      GOALKEEPING PROFILE
                    </span>
                    <div className="w-full space-y-3">
                      {gkRows.map((row) => (
                        <div key={row.key} className="grid grid-cols-[1fr_84px_28px] items-center gap-3">
                          <span className="truncate text-[11px] text-muted">{row.label}</span>
                          <Meter value={row.value} color={series.goalkeeping} height={5} />
                          <span className="num text-right text-[11px] font-semibold text-ink">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10.5px] leading-relaxed text-faint">
                      {player.position} peers compared on the five goalkeeping attributes instead of the
                      group fingerprint, which EA does not define for this position.
                    </p>
                  </div>
                )}
              </div>

              <div className="panel p-6">
                <p className="label-xs mb-4">Position percentile</p>
                <div className="flex items-baseline gap-3">
                  <AnimatedNumber value={stats.percentileInPosition} className="num text-[42px] leading-none font-bold text-ink" />
                  <span className="label-xs">/ 100 among {player.position}s</span>
                </div>
                <div className="mt-4">
                  <Meter value={stats.percentileInPosition} color="var(--color-a)" height={6} />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line-soft pt-4">
                  <div>
                    <Label className="mb-1.5">Strengths</Label>
                    <ul className="space-y-1">
                      {stats.strengths.map((s) => (
                        <li key={s.key} className="num text-[11px] text-muted">
                          {s.label} <span className="text-good">z {s.z >= 0 ? "+" : ""}{s.z.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <Label className="mb-1.5">Weaknesses</Label>
                    <ul className="space-y-1">
                      {stats.weaknesses.map((s) => (
                        <li key={s.key} className="num text-[11px] text-muted">
                          {s.label} <span className="text-bad">z {s.z.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "model" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="grid gap-5 lg:grid-cols-[1fr_1.1fr]"
          >
            <div className="flex flex-col gap-5">
              <div className="panel p-6">
                <p className="label-xs mb-5">Model prediction</p>
                <div className="flex items-baseline gap-4">
                  <AnimatedNumber
                    value={prediction.value}
                    digits={2}
                    className="num text-[clamp(2.6rem,6vw,4.2rem)] leading-none font-bold text-a"
                  />
                  <div className="pb-1.5">
                    <p className="num text-[12px] text-muted">published {player.overall}</p>
                    <p
                      className="num text-[12px] font-bold"
                      style={{ color: Math.abs(cal.residual) < 1.5 ? "var(--color-good)" : cal.residual > 0 ? "var(--color-warn)" : "var(--color-bad)" }}
                    >
                      {cal.residual >= 0 ? "+" : ""}
                      {cal.residual.toFixed(2)} residual
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-line-soft p-4" style={{ background: "rgba(255,255,255,0.014)" }}>
                  <p className="label-xs mb-2">{cal.label}</p>
                  <p className="text-[11.5px] leading-relaxed text-muted">{cal.note}</p>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line-soft pt-5">
                  <div>
                    <Label className="mb-1.5">Segment</Label>
                    <dd className="text-[12px] text-ink">{isGk ? "Goalkeepers" : "Outfield"}</dd>
                  </div>
                  <div>
                    <Label className="mb-1.5">Out-of-fold accuracy</Label>
                    <dd className="num text-[12px] text-ink">
                      ±{prediction.segment.metrics.cv.mae.toFixed(2)} ({prediction.segment.metrics.cv.r2.toFixed(3)} R²)
                    </dd>
                  </div>
                  <div>
                    <Label className="mb-1.5">Residual percentile</Label>
                    <dd className="num text-[12px] text-ink">p{cal.percentile}</dd>
                  </div>
                  <div>
                    <Label className="mb-1.5">Position baseline</Label>
                    <dd className="num text-[12px] text-ink">{prediction.baseline.toFixed(2)}</dd>
                  </div>
                </dl>
              </div>

              <div className="panel p-6">
                <p className="label-xs mb-1.5">Model-wide influence</p>
                <h2 className="mb-5 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                  {isGk ? "Goalkeeping" : "Outfield"} attribute share
                </h2>
                <ShareBars
                  items={groupInfluence(dataset, isGk).map((g) => ({
                    label: g.group.replace("physic", "physical"),
                    share: g.share,
                    group: g.group,
                  }))}
                />
              </div>
            </div>

            <div className="panel p-6">
              <p className="label-xs mb-1.5">Exact attribution</p>
              <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                What drives this rating
              </h2>
              <AttributionChart
                contributions={prediction.contributions.map((c) => ({
                  key: c.key,
                  label: c.label,
                  group: c.group,
                  points: c.points,
                }))}
                baseline={prediction.baseline}
                predicted={prediction.value}
                limit={14}
              />
              <p className="mt-6 border-t border-line-soft pt-4 text-[11px] leading-relaxed text-faint">
                The model is linear, so these bars are the arithmetic — not an estimate. They sum to the
                prediction minus the position baseline, with nothing left over.
              </p>
            </div>
          </motion.div>
        )}

        {tab === "peers" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="grid gap-5 lg:grid-cols-[1.3fr_1fr]"
          >
            <div className="panel p-6">
              <p className="label-xs mb-1.5">Scatter</p>
              <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                {isGk ? "Reflexes vs positioning" : "Pace vs shooting"}, {player.position}s
              </h2>
              <ScatterPlot
                points={peersScatter}
                xLabel={isGk ? "Reflexes" : "Pace"}
                yLabel={isGk ? "Positioning" : "Shooting"}
                xDomain={isGk ? [10, 99] : [40, 99]}
                yDomain={isGk ? [10, 99] : [10, 99]}
                highlightIds={[String(player.id)]}
                height={360}
              />
            </div>

            <div className="panel p-6">
              <p className="label-xs mb-1.5">Scout</p>
              <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                Closest profiles
              </h2>
              <DeltaBars
                rows={peers.map((peer) => ({
                  key: String(peer.id),
                  label: peer.displayName,
                  a: player.overall,
                  b: peer.overall,
                }))}
                aLabel="Overall"
                bLabel="vs"
                colorA="var(--color-a)"
                colorB="#5b6474"
                compact
              />
              <p className="mt-5 border-t border-line-soft pt-4 text-[11px] leading-relaxed text-faint">
                Ranked by Euclidean distance across the six published group ratings, restricted to{" "}
                {player.position}s and players who can also play the position.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* -------------------------------------------------- dataset context */}
      <Reveal>
        <ModelContext dataset={dataset} isGk={isGk} />
      </Reveal>
    </div>
  );
}

function ModelContext({ dataset, isGk }: { dataset: Dataset; isGk: boolean }) {
  const summary = useMemo(() => modelSummary(dataset, isGk), [dataset, isGk]);
  return (
    <div className="panel mt-12 p-6">
      <p className="label-xs mb-1.5">Context</p>
      <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
        {isGk ? "Goalkeeper" : "Outfield"} model, dataset-wide
      </h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="mb-2">Mean absolute error</Label>
          <p className="num text-[26px] leading-none font-bold text-ink">±{summary.meanAbsoluteError.toFixed(2)}</p>
        </div>
        <div>
          <Label className="mb-2">Within one point</Label>
          <p className="num text-[26px] leading-none font-bold text-good">{(summary.withinOne * 100).toFixed(1)}%</p>
        </div>
        <div>
          <Label className="mb-2">Calibrated share</Label>
          <p className="num text-[26px] leading-none font-bold text-ink">
            {((summary.calibrated / Math.max(1, summary.total)) * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <Label className="mb-2">Mean signed error</Label>
          <p className="num text-[26px] leading-none font-bold text-warn">
            {summary.meanSignedError >= 0 ? "+" : ""}
            {summary.meanSignedError.toFixed(3)}
          </p>
        </div>
      </div>
    </div>
  );
}

function medianGroups(dataset: Dataset, player: Player) {
  const peers = dataset.players.filter((p) => p.position === player.position);
  const out = {} as Record<(typeof GROUP_SHORTS)[number], number>;
  for (const key of GROUP_SHORTS) {
    const values = peers.map((p) => p.groups[key]).sort((a, b) => a - b);
    out[key] = values[values.length >> 1];
  }
  return out;
}

