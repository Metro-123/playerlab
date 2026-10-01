"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { DatasetLoader, useDataset } from "@/components/useDataset";
import { Label, Meter, Reveal, SectionHead } from "@/components/ui";
import { AttributionChart } from "@/components/charts/Attribution";
import { Portrait } from "@/components/PlayerCard";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, GROUP_MEMBERS, GROUP_SHORTS, type AttributeKey, type Attributes } from "@/lib/types";
import { GOALKEEPERS, isGoalkeeper, predict } from "@/lib/model";
import { fold } from "@/lib/selectors";
import { ratingColor } from "@/lib/theme";
import type { Player } from "@/lib/dataset";

const ACCENT = "var(--color-a)";

export function WhatIfPage() {
  const { dataset, progress, error } = useDataset();
  const params = useSearchParams();

  const [playerId, setPlayerId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<AttributeKey, number>>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!dataset) return;
    const requested = Number(params.get("player"));
    setPlayerId(dataset.byId.has(requested) ? requested : dataset.players[0].id);
  }, [dataset, params]);

  const player = playerId !== null ? dataset?.byId.get(playerId) : undefined;

  // Reset overrides whenever the subject changes.
  useEffect(() => {
    setOverrides({});
  }, [playerId]);

  const searchResults = useMemo(() => {
    if (!dataset || query.trim().length < 2) return [];
    const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
    return dataset.players
      .filter((p) => terms.every((t) => fold(`${p.displayName} ${p.club}`).includes(t)))
      .slice(0, 7);
  }, [dataset, query]);

  if (!dataset) return <DatasetLoader progress={progress} error={error} />;
  if (!player) return <DatasetLoader progress={1} error={null} />;

  return (
    <div className="pt-12 pb-10">
      <SectionHead
        eyebrow="What-If Lab"
        title="Move an attribute. See exactly what it costs."
        blurb="The model is linear, so this is arithmetic rather than a re-simulation. Each slider shows the rating points that single attribute is worth, and the total updates as you drag."
      />

      <div className="mb-8 flex flex-wrap items-end gap-4">
        <div className="relative w-full max-w-sm">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a player…"
            className="w-full rounded-full border border-line bg-panel/70 px-5 py-3 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-a/60"
          />
          {searchResults.length > 0 && (
            <ul className="panel absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto p-1.5">
              {searchResults.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setPlayerId(p.id);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-panel-2"
                  >
                    <span className="num w-7 shrink-0 text-[13px] font-bold" style={{ color: ratingColor(p.overall) }}>
                      {p.overall}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{p.displayName}</span>
                    <span className="num shrink-0 text-[10px] text-faint">{p.position}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href={`/players/${player.id}`} className="label-xs pb-3 text-faint hover:text-ink">
          view full profile →
        </Link>
      </div>

      <Lab player={player} overrides={overrides} setOverrides={setOverrides} />
    </div>
  );
}

/* ------------------------------------------------------------------ lab */

function Lab({
  player,
  overrides,
  setOverrides,
}: {
  player: Player;
  overrides: Partial<Record<AttributeKey, number>>;
  setOverrides: (next: Partial<Record<AttributeKey, number>>) => void;
}) {
  const isGk = isGoalkeeper(player);
  const base = useMemo(() => predict(player.attributes, player.position, isGk), [player, isGk]);

  const modified: Attributes = useMemo(
    () => ({ ...player.attributes, ...overrides }) as Attributes,
    [player.attributes, overrides],
  );

  const next = useMemo(() => predict(modified, player.position, isGk), [modified, player, isGk]);
  const rawBase = base.value;
  const rawNext = next.value;
  const delta = rawNext - rawBase;

  const changedKeys = Object.keys(overrides) as AttributeKey[];
  const contributionDelta = new Map<AttributeKey, number>();
  for (const key of changedKeys) {
    const before = base.contributions.find((c) => c.key === key)?.points ?? 0;
    const after = next.contributions.find((c) => c.key === key)?.points ?? 0;
    contributionDelta.set(key, after - before);
  }

  const perPoint = useMemo(() => {
    const map = new Map<AttributeKey, number>();
    for (const c of base.contributions) map.set(c.key, c.points);
    return map;
  }, [base]);

  const groups = ATTRIBUTE_GROUPS.filter((g) => (isGk ? g.key === "goalkeeping" : g.key !== "goalkeeping"));

  const set = (key: AttributeKey, value: number) => {
    const nextOverrides = { ...overrides };
    if (value === player.attributes[key]) delete nextOverrides[key];
    else nextOverrides[key] = value;
    setOverrides(nextOverrides);
  };

  const reset = () => setOverrides({});
  const maxAll = () => {
    const nextOverrides: Partial<Record<AttributeKey, number>> = {};
    for (const g of groups) for (const key of g.attributes) nextOverrides[key as AttributeKey] = 99;
    setOverrides(nextOverrides);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      {/* ------------------------------------------------------- controls */}
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.key} className="panel p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-[2px] w-5"
                  style={{ background: `var(--color-${group.key === "physical" ? "a" : "a"})` }}
                />
                <h2 className="label-xs">{group.label}</h2>
              </div>
            </div>

            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {[...new Set(group.attributes)].map((key) => {
                const attribute = key as AttributeKey;
                const original = player.attributes[attribute];
                const current = overrides[attribute] ?? original;
                const impact = contributionDelta.get(attribute) ?? 0;
                const weight = perPoint.get(attribute) ?? 0;
                const weightRef = base.contributions.find((c) => c.key === attribute);
                return (
                  <div key={attribute}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <span
                        className="truncate text-[11.5px] font-medium"
                        style={{ color: current !== original ? "#f2f5f9" : "#8a94a6" }}
                      >
                        {weightRef?.label ?? attribute}
                      </span>
                      <span className="flex items-baseline gap-2">
                        <span className="num text-[15px] font-bold text-ink">{current}</span>
                        {current !== original && (
                          <span className="num text-[10px] text-faint line-through">{original}</span>
                        )}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={99}
                      value={current}
                      onChange={(e) => set(attribute, Number(e.target.value))}
                      aria-label={`${weightRef?.label ?? attribute} value`}
                      className="w-full"
                      style={{ accentColor: current !== original ? "#a3e635" : undefined }}
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="num text-[9.5px] text-faint">
                        {weight >= 0 ? "+" : ""}
                        {weight.toFixed(3)}/pt to rating
                      </span>
                      {impact !== 0 && (
                        <span className="num text-[9.5px] font-bold" style={{ color: impact > 0 ? "var(--color-good)" : "var(--color-bad)" }}>
                          {impact > 0 ? "+" : ""}
                          {impact.toFixed(2)} overall
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* -------------------------------------------------------- readout */}
      <div className="xl:sticky xl:top-24 xl:self-start">
        <div className="panel p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-line-soft">
              <Portrait player={player} accent={ACCENT} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{player.displayName}</p>
              <p className="label-xs mt-1">
                {player.position} · {player.club}
              </p>
            </div>
          </div>

          <div className="border-y border-line-soft py-6">
            <Label className="mb-3">Predicted rating</Label>
            <div className="flex items-end gap-3">
              <motion.span
                key={Math.round(rawNext * 10)}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="num text-[54px] leading-none font-bold"
                style={{ color: ratingColor(rawNext) }}
              >
                {rawNext.toFixed(1)}
              </motion.span>
              {Math.abs(delta) > 0.005 && (
                <span
                  className="num mb-1.5 text-[16px] font-bold"
                  style={{ color: delta > 0 ? "var(--color-good)" : "var(--color-bad)" }}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(2)}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="num text-[12px] text-faint line-through">{rawBase.toFixed(1)}</span>
              <span className="label-xs">original</span>
              <span className="num ml-auto text-[12px] text-muted">published {player.overall}</span>
            </div>
          </div>

          {/* contribution bar */}
          <div className="py-6">
            <Label className="mb-3">Movement</Label>
            <div className="relative h-2 overflow-hidden rounded-full" style={{ background: "#12161e" }}>
              <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: "#2a3140" }} />
              <motion.div
                className="absolute inset-y-0 left-1/2"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(50, Math.abs(delta) * 14)}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                style={{
                  background: delta >= 0 ? "var(--color-good)" : "var(--color-bad)",
                  boxShadow: `0 0 14px ${delta >= 0 ? "var(--color-good)" : "var(--color-bad)"}66`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between">
              <span className="num text-[9.5px] text-faint">−3.5</span>
              <span className="num text-[9.5px] text-faint">+3.5 overall points</span>
            </div>
          </div>

          {changedKeys.length > 0 ? (
            <>
              <div className="border-t border-line-soft pt-5">
                <Label className="mb-4">Changed attributes</Label>
                <ul className="space-y-3">
                  {[...contributionDelta.entries()]
                    .filter(([, v]) => Math.abs(v) > 0.0005)
                    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                    .map(([key, value]) => (
                      <li key={key}>
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <span className="text-[11px] text-muted">
                            {ATTRIBUTE_LABELS[key]}{" "}
                            <span className="num text-faint">
                              {player.attributes[key]} → {overrides[key]}
                            </span>
                          </span>
                          <span
                            className="num text-[11px] font-bold"
                            style={{ color: value > 0 ? "var(--color-good)" : "var(--color-bad)" }}
                          >
                            {value > 0 ? "+" : ""}
                            {value.toFixed(3)}
                          </span>
                        </div>
                        <Meter
                          value={Math.min(100, Math.abs(value) * 60)}
                          color={value > 0 ? "var(--color-good)" : "var(--color-bad)"}
                          height={4}
                        />
                      </li>
                    ))}
                </ul>
                {contributionDelta.size === 0 && (
                  <p className="text-[11px] text-faint">No net movement yet — drag a slider.</p>
                )}
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 rounded-full border border-line px-4 py-2.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase transition-colors hover:border-a/50 hover:text-ink"
                >
                  Reset
                </button>
                <button
                  onClick={maxAll}
                  className="flex-1 rounded-full border border-line px-4 py-2.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase transition-colors hover:border-a/50 hover:text-ink"
                >
                  Max all
                </button>
              </div>
            </>
          ) : (
            <p className="border-t border-line-soft pt-5 text-[11px] leading-relaxed text-faint">
              Drag any slider. The number updates as the model recomputes, and the panel below lists
              exactly which attributes produced the change.
            </p>
          )}

          <div className="mt-6 border-t border-line-soft pt-5">
            <Label className="mb-3">Model accuracy here</Label>
            <p className="text-[11px] leading-relaxed text-faint">
              This segment predicts to ±{next.segment.metrics.cv.mae.toFixed(2)} out-of-fold.{" "}
              {Math.abs(delta) < 0.02 ? (
                <>Move a slider to see how the change compares against that error band.</>
              ) : (
                <>
                  The simulated change of {Math.abs(delta).toFixed(2)} points is{" "}
                  {Math.abs(delta) > next.segment.metrics.cv.mae * 2
                    ? "larger than the model's own error, so treat the exact value as indicative"
                    : "within the model's error band"}
                  .
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------- full attribution diff */}
      {changedKeys.length > 0 && (
        <Reveal>
          <div className="panel p-6 xl:col-span-2">
            <p className="label-xs mb-1.5">Full attribution after change</p>
            <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
              Top contributors to the simulated rating
            </h2>
            <AttributionChart
              contributions={next.contributions.slice(0, 14).map((c) => ({
                key: c.key,
                label: c.label,
                group: c.group,
                points: c.points,
              }))}
              baseline={next.baseline}
              predicted={rawNext}
              limit={14}
            />
          </div>
        </Reveal>
      )}

      <GroupPreview player={player} modified={modified} />
    </div>
  );
}

/** How the six published group ratings would move under the overrides. */
function GroupPreview({ player, modified }: { player: Player; modified: Attributes }) {
  const isGk = !player.hasGroupRatings;
  const rows = useMemo(() => {
    const estimate = (keys: AttributeKey[], current: Attributes) => {
      const sum = keys.reduce((a, k) => a + current[k], 0) / keys.length;
      return Math.round(sum);
    };
    return GROUP_SHORTS.map((short) => {
      const keys = GROUP_MEMBERS[short];
      const now = estimate(keys, player.attributes);
      const then = estimate(keys, modified);
      return { short, now, then, delta: then - now };
    });
  }, [player, modified]);

  if (isGk) {
    return (
      <div className="panel p-6 xl:col-span-2">
        <p className="label-xs mb-2" style={{ color: "var(--color-warn)" }}>
          No group ratings for goalkeepers
        </p>
        <p className="max-w-3xl text-[11.5px] leading-relaxed text-muted">
          FC 26 leaves PAC/SHO/PAS/DRI/DEF/PHY at zero for every goalkeeper, so there is nothing to
          re-estimate. The five goalkeeping attributes above carry the rating on their own — the
          goalkeeper model reconstructs an overall to ±{GOALKEEPERS.metrics.cv.mae.toFixed(2)} points
          out of fold without any group input at all.
        </p>
      </div>
    );
  }

  const anyChange = rows.some((r) => r.delta !== 0);

  return (
    <div className="panel p-6 xl:col-span-2">
      <p className="label-xs mb-1.5">Group estimates</p>
      <h2 className="mb-2 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
        Effect on the card ratings
      </h2>
      <p className="mb-6 text-[11px] leading-relaxed text-faint">
        EA computes each group as a weighted average of its members, so an unweighted mean is only an
        estimate — treat the direction as reliable and the magnitude as indicative.
      </p>
      <div className="grid gap-5 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.short} className="flex items-center justify-between border-b border-line-soft pb-3">
            <span className="label-xs">{row.short}</span>
            <span className="flex items-baseline gap-2">
              <span className="num text-[15px] text-ink">{row.then}</span>
              {anyChange && row.delta !== 0 && (
                <span
                  className="num text-[11px] font-bold"
                  style={{ color: row.delta > 0 ? "var(--color-good)" : "var(--color-bad)" }}
                >
                  {row.delta > 0 ? "+" : ""}
                  {row.delta}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
