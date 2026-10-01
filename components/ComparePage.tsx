"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { DatasetLoader, useDataset } from "@/components/useDataset";
import { Label, Meter, Reveal, SectionHead } from "@/components/ui";
import { DeltaBars } from "@/components/charts/Bars";
import { RadarChart, type RadarSeries } from "@/components/charts/Radar";
import { ScatterPlot } from "@/components/charts/Scatter";
import { DnaCompare } from "@/components/DnaFingerprint";
import { Portrait } from "@/components/PlayerCard";
import { ATTRIBUTE_GROUPS, GROUP_SHORTS, type AttributeKey } from "@/lib/types";
import { ATTRIBUTE_LABELS } from "@/lib/types";
import { predictPlayer } from "@/lib/model";
import { fold } from "@/lib/selectors";
import { ratingColor } from "@/lib/theme";
import type { Dataset, Player } from "@/lib/dataset";

const A_COLOR = "var(--color-a)";
const B_COLOR = "var(--color-b)";

export function ComparePage() {
  const { dataset, progress, error } = useDataset();
  const params = useSearchParams();

  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);

  useEffect(() => {
    if (!dataset) return;
    const a = Number(params.get("a"));
    const b = Number(params.get("b"));
    if (dataset.byId.has(a)) setAId(a);
    else setAId(dataset.players[0].id);
    if (dataset.byId.has(b)) setBId(b);
    else if (dataset.players[1]) setBId(dataset.players[1].id);
  }, [dataset, params]);

  if (!dataset) return <DatasetLoader progress={progress} error={error} />;

  const a = aId !== null ? dataset.byId.get(aId) : undefined;
  const b = bId !== null ? dataset.byId.get(bId) : undefined;

  return (
    <div className="pt-12 pb-10">
      <SectionHead
        eyebrow="Head to head"
        title="Compare"
        blurb="Two profiles, thirty-three attributes, one shared model. Deltas are computed on EA's own published values, not on a simplified score."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Picker dataset={dataset} side="A" color={A_COLOR} player={a} onChange={setAId} exclude={bId} />
        <Picker dataset={dataset} side="B" color={B_COLOR} player={b} onChange={setBId} exclude={aId} />
      </div>

      {a && b && <Comparison dataset={dataset} a={a} b={b} />}
    </div>
  );
}

/* ------------------------------------------------------------- picker */

function Picker({
  dataset,
  side,
  color,
  player,
  onChange,
  exclude,
}: {
  dataset: Dataset;
  side: "A" | "B";
  color: string;
  player?: Player;
  onChange: (id: number) => void;
  exclude: number | null;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
    const pool = terms.length
      ? dataset.players.filter((p) => {
          const hay = fold(`${p.displayName} ${p.club} ${p.nationality}`);
          return terms.every((t) => hay.includes(t));
        })
      : dataset.players;
    return pool.filter((p) => p.id !== exclude).slice(0, 8);
  }, [dataset, query, exclude]);

  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="mb-4 flex items-center justify-between">
        <span className="label-xs" style={{ color }}>
          Player {side}
        </span>
        {player && (
          <Link href={`/players/${player.id}`} className="label-xs text-faint hover:text-ink">
            profile →
          </Link>
        )}
      </div>

      {player && (
        <div className="mb-5 flex items-center gap-4">
          <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-line-soft">
            <Portrait player={player} accent={color} />
          </div>
          <div className="min-w-0">
            <p className="num text-[34px] leading-none font-bold" style={{ color: ratingColor(player.overall) }}>
              {player.overall}
            </p>
            <p className="mt-1.5 truncate text-[14px] font-semibold text-ink">{player.displayName}</p>
            <p className="num text-[10px] text-faint">
              {player.position} · {player.club}
            </p>
          </div>
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search to swap…"
        className="w-full rounded-lg border border-line bg-void/60 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-a/60"
      />

      <ul className="mt-2 max-h-56 overflow-y-auto">
        {results.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onChange(p.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-panel-2"
            >
              <span className="num w-7 shrink-0 text-[13px] font-bold" style={{ color: ratingColor(p.overall) }}>
                {p.overall}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-ink">{p.displayName}</span>
                <span className="num block truncate text-[10px] text-faint">
                  {p.position} · {p.club}
                </span>
              </span>
              {p.potential > p.overall && <span className="num text-[9.5px] text-b">P{p.potential}</span>}
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="px-2 py-3 text-[11px] text-faint">No match</li>}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------- comparison */

function Comparison({ dataset, a, b }: { dataset: Dataset; a: Player; b: Player }) {
  const groupComparable = a.hasGroupRatings && b.hasGroupRatings;
  const tabs = useMemo(
    () =>
      ([
        ["groups", "Group ratings"],
        ["attributes", "All 33 attributes"],
        ["dna", "Attribute DNA"],
        ["model", "Model verdict"],
      ] as const).filter(([key]) => groupComparable || (key !== "groups" && key !== "dna")),
    [groupComparable],
  );
  const [tab, setTab] = useState<(typeof tabs)[number][0]>(groupComparable ? "groups" : "attributes");

  useEffect(() => {
    if (!groupComparable && (tab === "groups" || tab === "dna")) setTab("attributes");
  }, [groupComparable, tab]);

  const groupRows = GROUP_SHORTS.map((key) => ({
    key,
    label: key,
    a: a.groups[key],
    b: b.groups[key],
  }));

  const attributeRows = useMemo(
    () =>
      ATTRIBUTE_GROUPS.filter((g) => (a.position === "GK" ? g.key === "goalkeeping" : g.key !== "goalkeeping")).flatMap(
        (group) =>
          group.attributes.map((key) => ({
            key: key as AttributeKey,
            label: ATTRIBUTE_LABELS[key as AttributeKey],
            a: a.attributes[key as AttributeKey],
            b: b.attributes[key as AttributeKey],
            group: group.key,
          })),
      ),
    [a, b],
  );

  const predictionA = useMemo(() => predictPlayer(a), [a]);
  const predictionB = useMemo(() => predictPlayer(b), [b]);

  const radarSeries: RadarSeries[] = [
    { id: "a", label: a.displayName, color: A_COLOR, values: a.groups },
    { id: "b", label: b.displayName, color: B_COLOR, values: b.groups },
  ];

  const overallDelta = a.overall - b.overall;
  const valueDelta = a.valueEur - b.valueEur;

  return (
    <div className="mt-12">
      {/* verdict bar */}
      <Reveal>
        <div className="panel mb-6 grid gap-6 p-6 md:grid-cols-3">
          <div>
            <Label className="mb-2">Overall</Label>
            <div className="flex items-baseline gap-3">
              <span className="num text-[40px] leading-none font-bold" style={{ color: A_COLOR }}>{a.overall}</span>
              <span className="label-xs">vs</span>
              <span className="num text-[40px] leading-none font-bold" style={{ color: B_COLOR }}>{b.overall}</span>
            </div>
            <p className="num mt-2 text-[11px] text-muted">
              {overallDelta === 0 ? "Level" : `${a.displayName} +${Math.abs(overallDelta)}`}
            </p>
          </div>
          <div>
            <Label className="mb-2">Model prediction</Label>
            <div className="flex items-baseline gap-3">
              <span className="num text-[28px] leading-none font-bold" style={{ color: A_COLOR }}>{predictionA.value.toFixed(1)}</span>
              <span className="label-xs">vs</span>
              <span className="num text-[28px] leading-none font-bold" style={{ color: B_COLOR }}>{predictionB.value.toFixed(1)}</span>
            </div>
            <p className="num mt-2 text-[11px] text-muted">
              Δ {(predictionA.value - predictionB.value).toFixed(2)} predicted points
            </p>
          </div>
          <div>
            <Label className="mb-2">Market value</Label>
            <div className="flex items-baseline gap-3">
              <span className="num text-[28px] leading-none font-bold text-ink">{fmtValue(a.valueEur)}</span>
              <span className="label-xs">vs</span>
              <span className="num text-[28px] leading-none font-bold text-ink">{fmtValue(b.valueEur)}</span>
            </div>
            <p className="num mt-2 text-[11px] text-muted">
              {valueDelta === 0 ? "Equal" : `${a.valueEur > b.valueEur ? a.displayName : b.displayName} +${fmtValue(Math.abs(valueDelta))}`}
            </p>
          </div>
        </div>
      </Reveal>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative px-4 py-3 text-[11px] font-semibold tracking-[0.12em] uppercase transition-colors ${
              tab === key ? "text-ink" : "text-faint hover:text-muted"
            }`}
          >
            {label}
            {tab === key && <motion.span layoutId="compare-tab" className="absolute inset-x-0 -bottom-px h-px bg-a" />}
          </button>
        ))}
      </nav>

      {tab === "groups" && groupComparable && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="panel p-6">
            <p className="label-xs mb-6">Group deltas</p>
            <DeltaBars rows={groupRows} aLabel={a.displayName} bLabel={b.displayName} colorA={A_COLOR} colorB={B_COLOR} />
          </div>
          <div className="panel flex flex-col items-center justify-center p-6">
            <RadarChart series={radarSeries} size={380} />
          </div>
        </motion.div>
      )}

      {tab === "attributes" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-6">
          <p className="label-xs mb-6">
            {a.position === "GK" ? "Goalkeeping" : "Outfield"} attributes, {a.position} vs {b.position}
          </p>
          <DeltaBars
            rows={attributeRows}
            aLabel={a.displayName}
            bLabel={b.displayName}
            colorA={A_COLOR}
            colorB={B_COLOR}
            compact
          />
        </motion.div>
      )}

      {tab === "dna" && groupComparable && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-6">
          <p className="label-xs mb-8">Shape similarity from the six group ratings</p>
          <DnaCompare
            size={200}
            a={{ id: String(a.id), name: a.displayName, position: a.position, color: A_COLOR, values: a.groups }}
            b={{ id: String(b.id), name: b.displayName, position: b.position, color: B_COLOR, values: b.groups }}
          />
          <p className="mx-auto mt-8 max-w-lg text-center text-[11px] leading-relaxed text-faint">
            Each shape is a closed polygon whose radius on every axis is that group rating, with an inner
            core whose pull encodes how balanced the profile is. Two players with the same overall can look
            nothing alike.
          </p>
        </motion.div>
      )}

      {tab === "model" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-5 lg:grid-cols-2">
          <ModelSide player={a} color={A_COLOR} other={b} />
          <ModelSide player={b} color={B_COLOR} other={a} />
        </motion.div>
      )}

      <Reveal>
        <div className="panel mt-5 p-6">
          <p className="label-xs mb-5">Attribute scatter across both positions</p>
          <ScatterPlot
            points={dataset.players
              .filter((p) => p.position === a.position || p.position === b.position)
              .slice(0, 800)
              .map((p) => ({
                id: String(p.id),
                name: p.displayName,
                position: p.position,
                x: p.attributes.sprintSpeed,
                y: p.attributes.finishing,
                overall: p.overall,
              }))}
            xLabel="Sprint speed"
            yLabel="Finishing"
            xDomain={[30, 99]}
            yDomain={[5, 99]}
            highlightIds={[String(a.id), String(b.id)]}
            height={340}
            onSelect={(id) => {
              window.location.href = `/players/${id}`;
            }}
          />
        </div>
      </Reveal>
    </div>
  );
}

function ModelSide({ player, color, other }: { player: Player; color: string; other: Player }) {
  const prediction = useMemo(() => predictPlayer(player), [player]);
  const residual = player.overall - prediction.value;
  const otherPrediction = useMemo(() => predictPlayer(other), [other]);
  const gap = prediction.value - otherPrediction.value;

  return (
    <div className="panel p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[14px] font-semibold text-ink">{player.displayName}</p>
          <p className="label-xs mt-1">
            {player.position} · {player.club}
          </p>
        </div>
        <span className="num text-[28px] leading-none font-bold" style={{ color }}>
          {prediction.value.toFixed(1)}
        </span>
      </div>

      <div className="mb-5 space-y-2.5">
        {prediction.contributions.slice(0, 8).map((c) => (
          <div key={c.key}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[11px] text-muted">{c.label}</span>
              <span className="num text-[11px] font-bold" style={{ color: c.points >= 0 ? "var(--color-good)" : "var(--color-bad)" }}>
                {c.points >= 0 ? "+" : ""}
                {c.points.toFixed(2)}
              </span>
            </div>
            <Meter
              value={Math.abs(c.points) * 14}
              color={c.points >= 0 ? "var(--color-good)" : "var(--color-bad)"}
              height={4}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-line-soft pt-4">
        <div>
          <Label className="mb-1">Published</Label>
          <p className="num text-[15px] font-bold text-ink">{player.overall}</p>
        </div>
        <div>
          <Label className="mb-1">Residual</Label>
          <p
            className="num text-[15px] font-bold"
            style={{ color: Math.abs(residual) < 1.5 ? "var(--color-good)" : residual > 0 ? "var(--color-warn)" : "var(--color-bad)" }}
          >
            {residual >= 0 ? "+" : ""}
            {residual.toFixed(2)}
          </p>
        </div>
        <div>
          <Label className="mb-1">Edge</Label>
          <p className="num text-[15px] font-bold" style={{ color }}>
            {gap >= 0 ? "+" : ""}
            {gap.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

function fmtValue(eur: number): string {
  if (eur <= 0) return "Free";
  if (eur >= 1e9) return `€${(eur / 1e9).toFixed(2)}B`;
  if (eur >= 1e6) return `€${(eur / 1e6).toFixed(0)}M`;
  return `€${(eur / 1e3).toFixed(0)}K`;
}

