"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DatasetLoader, useDataset } from "@/components/useDataset";
import { AnimatedNumber, Chip, Label, Meter, Reveal, SectionHead } from "@/components/ui";
import { ShareBars } from "@/components/charts/Attribution";
import { attributeImpacts, groupInfluence, model, modelSummary, type ModelSegment } from "@/lib/model";
import { series } from "@/lib/theme";
import type { Dataset } from "@/lib/dataset";

export function ModelsPage() {
  const { dataset, progress, error } = useDataset();
  const [segment, setSegment] = useState<"outfield" | "goalkeepers">("outfield");
  if (!dataset) return <DatasetLoader progress={progress} error={error} />;
  return <Models dataset={dataset} segment={segment} setSegment={setSegment} />;
}

function Models({
  dataset,
  segment,
  setSegment,
}: {
  dataset: Dataset;
  segment: "outfield" | "goalkeepers";
  setSegment: (s: "outfield" | "goalkeepers") => void;
}) {
  const isGk = segment === "goalkeepers";
  const current: ModelSegment = isGk ? model.segments.goalkeepers : model.segments.outfield;
  const summary = useMemo(() => modelSummary(dataset, isGk), [dataset, isGk]);
  const impacts = useMemo(() => attributeImpacts(dataset, isGk), [dataset, isGk]);
  const groups = useMemo(() => groupInfluence(dataset, isGk), [dataset, isGk]);

  return (
    <div className="pt-12 pb-10">
      <SectionHead
        eyebrow="Model insights"
        title="What the model actually knows"
        blurb={`Ridge regression over ${model.dataset.players.toLocaleString()} FC ${model.dataset.season} profiles, trained ${model.trainedAt}. Regularisation chosen by 5-fold cross-validation; every metric below is out-of-fold.`}
      />

      <div className="mb-8 flex gap-1">
        {(
          [
            ["outfield", `Outfield · ${model.segments.outfield.n.toLocaleString()}`],
            ["goalkeepers", `Goalkeepers · ${model.segments.goalkeepers.n.toLocaleString()}`],
          ] as const
        ).map(([key, label]) => (
          <Chip key={key} active={segment === key} onClick={() => setSegment(key)}>
            {label}
          </Chip>
        ))}
      </div>

      {/* -------------------------------------------------------- metrics */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Cross-validated R²"
          value={current.metrics.cv.r2}
          digits={3}
          color="var(--color-good)"
          note="variance explained on held-out folds"
        />
        <Stat
          label="Mean absolute error"
          value={current.metrics.cv.mae}
          digits={3}
          prefix="±"
          color="var(--color-a)"
          note="average rating points off"
        />
        <Stat
          label="Within one point"
          value={current.metrics.cv.within1}
          digits={3}
          suffix=" (×100)"
          scale={100}
          color="var(--color-b)"
          note="share of players reconstructed exactly enough to round"
        />
        <Stat
          label="Baseline MAE"
          value={current.metrics.baselines.positionMedian.mae}
          digits={3}
          prefix="±"
          color="var(--color-faint)"
          note="predicting the position median instead"
        />
      </div>

      <Reveal>
        <div className="panel mb-6 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label-xs mb-1.5">Lift over baseline</p>
              <h2 className="text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                The model is {(current.metrics.baselines.positionMedian.mae / current.metrics.cv.mae).toFixed(1)}×
                more accurate than guessing the position median
              </h2>
            </div>
            <Link
              href="/whatif"
              className="rounded-full border border-line px-4 py-2 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase transition-colors hover:border-a/50 hover:text-ink"
            >
              Try the What-If Lab
            </Link>
          </div>
          <div className="space-y-3">
            <Comparison
              label="Ridge regression (5-fold CV)"
              mae={current.metrics.cv.mae}
              r2={current.metrics.cv.r2}
              color="var(--color-a)"
            />
            <Comparison
              label="In-sample fit"
              mae={current.metrics.inSample.mae}
              r2={current.metrics.inSample.r2}
              color="#7dd3fc"
            />
            <Comparison
              label="Position median baseline"
              mae={current.metrics.baselines.positionMedian.mae}
              r2={current.metrics.baselines.positionMedian.r2}
              color="#5b6474"
            />
          </div>
        </div>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* ------------------------------------------------- feature table */}
        <Reveal>
          <div className="panel p-6">
            <p className="label-xs mb-1.5">Coefficients</p>
            <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
              Rating points per attribute point
            </h2>
            <ul>
              {impacts.map((item) => (
                <li
                  key={item.key}
                  className="grid grid-cols-[1fr_1.1fr_64px] items-center gap-3 border-b border-line-soft/60 py-2.5"
                >
                  <span className="flex items-center gap-2 truncate text-[11px] text-muted">
                    <span
                      className="h-[2px] w-2.5 shrink-0"
                      style={{ background: series[item.group as keyof typeof series] ?? "#5b6474" }}
                    />
                    {item.label}
                  </span>
                  <Meter
                    value={Math.min(100, (Math.abs(item.perPoint) / 0.3) * 100)}
                    color={series[item.group as keyof typeof series] ?? "#5b6474"}
                    height={5}
                  />
                  <span
                    className="num text-right text-[11px] font-bold"
                    style={{ color: item.perPoint >= 0 ? "var(--color-good)" : "var(--color-bad)" }}
                  >
                    {item.perPoint >= 0 ? "+" : ""}
                    {item.perPoint.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[11px] leading-relaxed text-faint">
              Bar length is absolute weight. {impacts.filter((i) => i.perPoint > 0).length} of{" "}
              {impacts.length} {isGk ? "goalkeeper" : "outfield"} features push the predicted rating up;{" "}
              {impacts.filter((i) => i.perPoint < 0).length} push it down. A negative coefficient is not
              EA penalising an attribute — it is collinearity. Pace and passing move together across a
              squad, so the ridge fit splits a shared signal between them and some weights land below zero.
            </p>
          </div>
        </Reveal>

        <div className="flex flex-col gap-5">
          {/* --------------------------------------------- group influence */}
          <Reveal delay={0.05}>
            <div className="panel p-6">
              <p className="label-xs mb-1.5">Share of influence</p>
              <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                By attribute group
              </h2>
              <ShareBars
                items={groups.map((g) => ({
                  label: g.group.replace("physic", "physical"),
                  share: g.share,
                  group: g.group,
                }))}
              />
            </div>
          </Reveal>

          {/* -------------------------------------------------- alpha curve */}
          <Reveal delay={0.08}>
            <div className="panel p-6">
              <p className="label-xs mb-1.5">Model selection</p>
              <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                Regularisation sweep
              </h2>
              <AlphaSweep search={current.metrics.alphaSearch} selected={current.alpha} />
              <p className="mt-4 text-[11px] leading-relaxed text-faint">
                Alpha = {current.alpha}. The curve is almost flat, which means the fit is not sensitive to
                the choice — the signal is in the features, not the penalty.
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      {/* -------------------------------------------------- residual study */}
      <Reveal>
        <div className="panel mt-5 p-6">
          <p className="label-xs mb-1.5">Residual analysis</p>
          <h2 className="mb-2 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
            Where the game and the model disagree
          </h2>
          <p className="mb-6 max-w-2xl text-[11px] leading-relaxed text-faint">
            Residual = published overall − out-of-fold prediction. Positive means the game awards more than
            the attribute profile explains; position-specific weightings EA does not publish are the most
            likely cause.
          </p>

          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="label-xs mb-3">Bias by position</p>
              <ul className="space-y-2">
                {summary.byPosition.map((row) => (
                  <li key={row.position} className="grid grid-cols-[46px_1fr_64px] items-center gap-3">
                    <span className="num text-[11px] font-semibold text-ink">{row.position}</span>
                    <div className="relative h-[5px] rounded-full" style={{ background: "#12161e" }}>
                      <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: "#2a3140" }} />
                      <div
                        className="absolute inset-y-0"
                        style={{
                          left: row.bias >= 0 ? "50%" : `${50 + (row.bias / 4) * 50}%`,
                          width: `${Math.min(50, (Math.abs(row.bias) / 4) * 50)}%`,
                          background: row.bias >= 0 ? "var(--color-warn)" : "var(--color-bad)",
                        }}
                      />
                    </div>
                    <span className="num text-right text-[10.5px] text-muted">
                      {row.bias >= 0 ? "+" : ""}
                      {row.bias.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-line-soft pt-2">
                <span className="label-xs">−4</span>
                <span className="label-xs">+4 rating points</span>
              </div>
            </div>

            <div>
              <p className="label-xs mb-3">Largest disagreements</p>
              <ul className="space-y-1.5">
                {summary.largestGaps.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/players/${row.id}`}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-2"
                    >
                      <span className="truncate text-[11px] text-ink">{row.name}</span>
                      <span className="num text-[10px] text-faint">{row.position}</span>
                      <span
                        className="num w-12 text-right text-[11px] font-bold"
                        style={{ color: row.residual >= 0 ? "var(--color-warn)" : "var(--color-bad)" }}
                      >
                        {row.residual >= 0 ? "+" : ""}
                        {row.residual.toFixed(2)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Reveal>

      {/* --------------------------------------------------- methodology */}
      <Reveal>
        <div className="panel mt-5 p-6">
          <p className="label-xs mb-1.5">Methodology</p>
          <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
            What we tried, and what it bought
          </h2>

          <div className="mb-8 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="label-xs py-2 text-left">Feature set</th>
                  <th className="label-xs py-2 text-right">CV R²</th>
                  <th className="label-xs py-2 text-right">CV MAE</th>
                  <th className="label-xs py-2 pl-6 text-left">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {model.diagnostics.map((row) => (
                  <tr key={row.features} className="border-b border-line-soft/60">
                    <td className="py-2.5 text-[11.5px] text-ink">{row.features}</td>
                    <td className="num py-2.5 text-right text-[11.5px] text-good">{row.cvR2.toFixed(4)}</td>
                    <td className="num py-2.5 text-right text-[11.5px] text-muted">{row.cvMae.toFixed(3)}</td>
                    <td className="py-2.5 pl-6 text-[11px] text-faint">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mb-8 max-w-3xl text-[11.5px] leading-relaxed text-muted">
            The ~1.4 point out-of-fold error on outfielders is not a modelling shortfall that a bigger
            model fixes: EA&rsquo;s eligibility flags and attribute × position interactions were both tested
            and neither moved R². That points to a hidden, unpublished position-weighting step applied
            before the overall is published — the attributes are in the file, the weighting that turns
            them into an overall is not. Goalkeepers, whose formula is not position-dependent, are
            reproduced to ±{model.segments.goalkeepers.metrics.cv.mae.toFixed(2)}, which is the control
            that confirms the ceiling is informational rather than algorithmic.
          </p>

          <div className="grid gap-4 border-t border-line-soft pt-6 md:grid-cols-2">
            <div>
              <p className="label-xs mb-3">Group-rating validation</p>
              <p className="mb-4 text-[11px] leading-relaxed text-faint">
                We tried to reconstruct EA&rsquo;s six published group ratings as a weighted average of
                their member attributes. Pace and defending reproduce; shooting does not, so PLAYERLAB uses
                the published group values verbatim and never derives them.
              </p>
              <ul className="space-y-1.5">
                {Object.entries(model.groupValidation).map(([group, v]) => (
                  <li key={group} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                    <span className="text-[11px] capitalize text-muted">{group}</span>
                    <span className="num text-[10.5px] text-faint">MAE {v.mae.toFixed(2)}</span>
                    <span
                      className="num w-14 text-right text-[10.5px] font-bold"
                      style={{ color: v.within1 > 0.8 ? "var(--color-good)" : v.within1 > 0.4 ? "var(--color-warn)" : "var(--color-bad)" }}
                    >
                      ±1 {(v.within1 * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="label-xs mb-3">Dataset</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {[
                  ["Source", model.dataset.source],
                  ["Rows kept", `${model.dataset.players.toLocaleString()} of 18,405`],
                  ["Overall floor", String(model.dataset.minOverall)],
                  ["Attributes", "34"],
                  ["Segments", "2 (outfield, goalkeepers)"],
                  ["Folds", String(current.metrics.folds)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="label-xs">{k}</dt>
                    <dd className="num mt-1 text-[11.5px] text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* -------------------------------------------------------------- pieces */

function Stat({
  label,
  value,
  digits,
  prefix = "",
  suffix = "",
  scale = 1,
  color,
  note,
}: {
  label: string;
  value: number;
  digits: number;
  prefix?: string;
  suffix?: string;
  scale?: number;
  color: string;
  note: string;
}) {
  return (
    <div className="panel p-5">
      <Label className="mb-3">{label}</Label>
      <p className="num text-[clamp(1.6rem,3vw,2.2rem)] leading-none font-bold" style={{ color }}>
        <AnimatedNumber value={value * scale} digits={digits} prefix={prefix} suffix={suffix} />
      </p>
      <p className="mt-3 text-[10.5px] leading-relaxed text-faint">{note}</p>
    </div>
  );
}

function Comparison({ label, mae, r2, color }: { label: string; mae: number; r2: number; color: string }) {
  const worst = 5;
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
      <span className="text-[11px] text-muted">{label}</span>
      <Meter value={(1 - mae / worst) * 100} color={color} height={6} />
      <span className="num w-28 text-right text-[11px] text-ink">
        ±{mae.toFixed(3)} · {r2.toFixed(3)}
      </span>
    </div>
  );
}

function AlphaSweep({ search, selected }: { search: Array<{ alpha: number; mae: number; r2: number }>; selected: number }) {
  const best = Math.min(...search.map((s) => s.mae));
  const worst = Math.max(...search.map((s) => s.mae));
  return (
    <ul className="space-y-1.5">
      {search.map((row) => {
        const isBest = row.mae === best;
        return (
          <li key={row.alpha} className="grid grid-cols-[58px_1fr_58px] items-center gap-3">
            <span className="num text-[10.5px]" style={{ color: row.alpha === selected ? "#f2f5f9" : "#5b6474" }}>
              α {row.alpha}
            </span>
            <div className="relative h-[5px] rounded-full" style={{ background: "#12161e" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${100 - ((row.mae - best) / (worst - best || 1)) * 100}%`,
                  background: isBest ? "var(--color-good)" : "#2b3444",
                }}
              />
            </div>
            <span className="num text-right text-[10.5px]" style={{ color: isBest ? "var(--color-good)" : "#5b6474" }}>
              {row.mae.toFixed(3)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
