"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { DatasetLoader, useDataset } from "@/components/useDataset";
import { AnimatedNumber, Label, Meter, Reveal } from "@/components/ui";
import { DnaFingerprint } from "@/components/DnaFingerprint";
import { Portrait } from "@/components/PlayerCard";
import { datasetInfo } from "@/lib/info";
import { model, modelSummary, OUTFIELD, predictRaw, groupInfluence } from "@/lib/model";
import { series } from "@/lib/theme";
import { GK_BY_SHORT, type GkShort, type GroupShort } from "@/lib/types";
import type { Dataset } from "@/lib/dataset";

const HeroScene = dynamic(() => import("@/components/three/HeroScene").then((m) => m.HeroScene), {
  ssr: false,
  loading: () => null,
});

export function LandingPage() {
  const { dataset, progress, error } = useDataset();

  if (!dataset) {
    return <DatasetLoader progress={progress} error={error} />;
  }

  return <Landing dataset={dataset} />;
}

function Landing({ dataset }: { dataset: Dataset }) {
  const summary = modelSummary(dataset);
  const top = dataset.players.slice(0, 6);
  const groups = groupInfluence(dataset);
  const hero = top[0];
  const heroPrediction = predictRaw(hero.attributes, hero.position, false);

  return (
    <div className="pt-10">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative -mx-5 mb-24 min-h-[78vh] overflow-hidden sm:-mx-8">
        <HeroScene dataset={dataset} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 55% at 50% 45%, transparent 0%, rgba(6,7,10,0.74) 78%, #06070a 100%)",
          }}
        />

        <div className="relative mx-auto flex min-h-[78vh] max-w-[1400px] flex-col justify-center px-5 py-24 sm:px-8">
          <Reveal>
            <p className="label-xs mb-6 flex items-center gap-2.5 text-a">
              <span className="h-px w-10 bg-a/50" />
              Attribute intelligence · FC {datasetInfo.season} · {datasetInfo.source}
            </p>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="max-w-4xl text-[clamp(2.6rem,8vw,6.4rem)] leading-[0.94] font-semibold tracking-[-0.045em] text-ink">
              Every rating has
              <br />
              <span className="bg-gradient-to-r from-a via-[#7dd3fc] to-b bg-clip-text text-transparent">
                a reason.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-muted">
              PLAYERLAB learns what actually drives an overall rating from {datasetInfo.count.toLocaleString()}{" "}
              real FC {datasetInfo.season} player profiles, then shows you the arithmetic. Ridge
              regression, cross-validated at R² {model.segments.outfield.metrics.cv.r2.toFixed(3)} for
              outfielders and {model.segments.goalkeepers.metrics.cv.r2.toFixed(3)} for keepers. Because
              the model is linear, every prediction splits into exact per-attribute contributions.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/players"
                className="group relative overflow-hidden rounded-full bg-ink px-6 py-3 text-[11px] font-semibold tracking-[0.14em] text-void uppercase transition-transform hover:scale-[1.03]"
              >
                Explore {datasetInfo.count.toLocaleString()} players
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </Link>
              <Link
                href="/whatif"
                className="rounded-full border border-line px-6 py-3 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase transition-colors hover:border-a/50 hover:text-ink"
              >
                Open What-If Lab
              </Link>
              <Link
                href="/models"
                className="rounded-full border border-line px-6 py-3 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase transition-colors hover:border-a/50 hover:text-ink"
              >
                Model insights
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-7 sm:grid-cols-4">
              {[
                { k: "Players", v: datasetInfo.count, digits: 0 },
                { k: "Clubs", v: datasetInfo.clubs, digits: 0 },
                { k: "CV R² outfield", v: model.segments.outfield.metrics.cv.r2, digits: 3 },
                { k: "CV MAE outfield", v: model.segments.outfield.metrics.cv.mae, digits: 2 },
              ].map((item) => (
                <div key={item.k}>
                  <dt className="label-xs mb-2">{item.k}</dt>
                  <dd className="num text-[clamp(1.4rem,2.6vw,2rem)] leading-none font-bold text-ink">
                    <AnimatedNumber value={item.v} digits={item.digits} />
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------- headline player */}
      <section className="mb-28">
        <Reveal>
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="label-xs mb-3 text-a">Model spotlight</p>
              <h2 className="text-[clamp(1.6rem,3.4vw,2.6rem)] leading-tight font-semibold tracking-[-0.03em]">
                Highest-rated profile in the set
              </h2>
            </div>
            <Link href={`/players/${hero.id}`} className="label-xs shrink-0 text-muted hover:text-ink">
              Full profile →
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="panel grid gap-8 p-6 lg:grid-cols-[1fr_auto_1.15fr] lg:items-center">
            <div>
              <div className="flex items-start gap-5">
                <Link
                  href={`/players/${hero.id}`}
                  className="relative -mt-1 h-36 w-[104px] shrink-0 overflow-hidden rounded-lg border border-line-soft bg-elev/60 sm:h-44 sm:w-[124px]"
                >
                  <Portrait player={hero} accent="var(--color-a)" size={240} />
                </Link>
                <div className="pt-1">
                  <AnimatedNumber
                    value={hero.overall}
                    className="num text-[clamp(3.4rem,7vw,5.4rem)] leading-none font-bold text-ink"
                  />
                  <div className="pt-2">
                    <p className="text-lg font-semibold tracking-tight text-ink">{hero.displayName}</p>
                    <p className="label-xs mt-1.5">
                      {hero.position} · {hero.club}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                {(["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"] as const).map((key) => (
                  <div key={key} className="grid grid-cols-[34px_1fr_30px] items-center gap-3">
                    <span className="label-xs">{key}</span>
                    <Meter value={hero.groups[key]} color={series[groupKey(key)]} />
                    <span className="num text-right text-[12px] font-semibold text-ink">{hero.groups[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden h-56 w-px lg:block" style={{ background: "#1a1f29" }} />

            <div className="flex flex-col items-center gap-4">
              <DnaFingerprint
                profile={{ id: String(hero.id), name: hero.displayName, position: hero.position, color: "var(--color-a)", values: hero.groups }}
                size={230}
              />
              <div className="flex items-baseline gap-2">
                <span className="num text-[22px] font-bold text-a">{heroPrediction.toFixed(1)}</span>
                <span className="label-xs">model prediction</span>
              </div>
              <p className="max-w-xs text-center text-[11px] leading-relaxed text-faint">
                Reconstructed from attributes alone, and{" "}
                {Math.abs(hero.overall - heroPrediction).toFixed(1)} points from the published {hero.overall}.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* --------------------------------------------------------- drivers */}
      <section className="mb-28">
        <Reveal>
          <div className="mb-8">
            <p className="label-xs mb-3 text-a">What drives a rating</p>
            <h2 className="max-w-2xl text-[clamp(1.6rem,3.4vw,2.6rem)] leading-tight font-semibold tracking-[-0.03em]">
              Weight × spread. Nothing else.
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Reveal delay={0.05}>
            <div className="panel p-6">
              <p className="label-xs mb-1.5">Feature influence</p>
              <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                Outfield, share of total
              </h2>
              <ul className="space-y-4">
                {groups.map((g) => (
                  <li key={g.group}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-[12px] font-medium text-muted capitalize">
                        {g.group.replace("physic", "physical")}
                      </span>
                      <span className="num text-[12px] font-bold" style={{ color: series[g.group as keyof typeof series] }}>
                        {(g.share * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Meter value={g.share * 100 * 2.6} color={series[g.group as keyof typeof series]} height={6} />
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-line-soft pt-4 text-[11px] leading-relaxed text-faint">
                Influence is |rating points per attribute point| × the attribute&rsquo;s spread across{" "}
                {OUTFIELD.n.toLocaleString()} outfielders. Two attributes can carry the same weight and
                still differ in consequence, if one of them barely varies between players.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="panel p-6">
              <p className="label-xs mb-1.5">Calibration</p>
              <h2 className="mb-6 text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">
                Model vs published rating
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <Metric label="Calibrated" value={summary.calibrated} total={summary.total} color="var(--color-good)" />
                <Metric label="Under-valued" value={summary.underValued} total={summary.total} color="var(--color-a)" />
                <Metric label="Over-valued" value={summary.overValued} total={summary.total} color="var(--color-bad)" />
                <Metric label="Mean signed error" value={summary.meanSignedError} color="var(--color-warn)" signed />
              </div>
              <p className="mt-6 border-t border-line-soft pt-4 text-[11px] leading-relaxed text-faint">
                A positive residual means the game awards more than the attribute profile explains. The
                largest gaps cluster at positional extremes — see{" "}
                <Link href="/models" className="text-a hover:underline">
                  position bias
                </Link>
                .
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- cards */}
      <section className="mb-28">
        <Reveal>
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="label-xs mb-3 text-a">Top of the set</p>
              <h2 className="text-[clamp(1.6rem,3.4vw,2.6rem)] leading-tight font-semibold tracking-[-0.03em]">
                Highest overall
              </h2>
            </div>
            <Link href="/players" className="label-xs shrink-0 text-muted hover:text-ink">
              All {datasetInfo.count.toLocaleString()} →
            </Link>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {top.map((player, i) => (
            <Reveal key={player.id} delay={i * 0.05} className="flex justify-center">
              <TopCard player={player} rank={i + 1} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- routes */}
      <section className="grid gap-px border border-line sm:grid-cols-2 lg:grid-cols-4" style={{ background: "#1a1f29" }}>
        {[
          { href: "/players", t: "Players", d: "Filter 34 attributes across the full set." },
          { href: "/compare", t: "Compare", d: "Head-to-head deltas, radar and DNA shape match." },
          { href: "/whatif", t: "What-If Lab", d: "Move any attribute. Watch the rating move exactly." },
          { href: "/models", t: "Model", d: "Metrics, feature weights, residual analysis." },
        ].map((route, i) => (
          <Reveal key={route.href} delay={i * 0.05}>
            <Link href={route.href} className="group relative block h-full bg-graphite p-7 transition-colors hover:bg-panel">
              <span className="num text-[11px] text-faint">0{i + 1}</span>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">{route.t}</h3>
              <p className="mt-2 text-[12px] leading-relaxed text-faint">{route.d}</p>
              <span className="absolute right-6 bottom-6 text-a opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                →
              </span>
            </Link>
          </Reveal>
        ))}
      </section>
    </div>
  );
}

function groupKey(short: string): keyof typeof series {
  return ({ PAC: "pace", SHO: "shooting", PAS: "passing", DRI: "dribbling", DEF: "defending", PHY: "physical" } as const)[
    short as "PAC"
  ];
}

function TopCard({ player, rank }: { player: Dataset["players"][number]; rank: number }) {
  return (
    <motion.article
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-line bg-gradient-to-b from-panel to-graphite p-4"
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ boxShadow: "0 0 0 1px rgba(34,211,238,0.35), 0 14px 44px -18px rgba(34,211,238,0.5)" }}
      />
      <div>
        <div className="flex items-start justify-between">
          <span className="num text-[10px] text-faint">#{rank}</span>
          <span className="label-xs">{player.position}</span>
        </div>
        <p className="num mt-3 text-[38px] leading-none font-bold text-ink">{player.overall}</p>
        <p className="mt-3 truncate text-[12.5px] font-semibold tracking-tight text-ink">{player.displayName}</p>
        <p className="truncate text-[10px] text-faint">{player.club}</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-x-2 gap-y-1.5 border-t border-line-soft pt-3">
        {(player.hasGroupRatings
          ? (["PAC", "SHO", "DEF"] as const)
          : (["REF", "POS", "DIV"] as const)
        ).map((k) => {
          const value = player.hasGroupRatings
            ? player.groups[k as GroupShort]
            : player.attributes[GK_BY_SHORT[k as GkShort]];
          return (
            <div key={k} className="flex items-baseline justify-between">
              <span className="text-[8.5px] tracking-[0.1em] text-faint">{k}</span>
              <span
                className="num text-[11px] font-bold"
                style={{ color: player.hasGroupRatings ? series[groupKey(k)] : series.goalkeeping }}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </motion.article>
  );
}

function Metric({ label, value, total, color, signed }: { label: string; value: number; total?: number; color: string; signed?: boolean }) {
  return (
    <div>
      <Label className="mb-2">{label}</Label>
      <p className="num text-[clamp(1.3rem,2.4vw,1.9rem)] leading-none font-bold" style={{ color }}>
        {signed && value > 0 ? "+" : ""}
        <AnimatedNumber value={value} digits={signed ? 2 : 0} />
      </p>
      {total !== undefined && (
        <>
          <div className="mt-2.5">
            <Meter value={(value / total) * 100} color={color} height={3} />
          </div>
          <p className="num mt-1.5 text-[10px] text-faint">{((value / total) * 100).toFixed(1)}% of set</p>
        </>
      )}
    </div>
  );
}
