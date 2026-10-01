"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DatasetLoader, useDataset } from "@/components/useDataset";
import { PlayerCard } from "@/components/PlayerCard";
import { Chip, Empty, SectionHead } from "@/components/ui";
import { applyFilters, DEFAULT_FILTERS, sortPlayers, type FilterState } from "@/lib/selectors";
import { datasetInfo } from "@/lib/info";
import { useSearchParams } from "next/navigation";

const SORTS = [
  { key: "overall", label: "Overall" },
  { key: "potential", label: "Potential" },
  { key: "value", label: "Value" },
  { key: "wage", label: "Wage" },
  { key: "age", label: "Age" },
  { key: "name", label: "Name" },
  { key: "height", label: "Height" },
];

const PAGE_SIZE = 24;

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label-xs">{label}</span>
        <span className="num text-[11px] font-bold text-ink">{value}</span>
      </div>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

export function PlayersPage() {
  const { dataset, progress, error } = useDataset();
  const params = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState("overall");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const searchQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(searchQuery);
  useEffect(() => setQuery(searchQuery), [searchQuery]);

  const results = useMemo(
    () => (dataset ? sortPlayers(applyFilters(dataset, { ...filters, query }), sort) : []),
    [dataset, filters, query, sort],
  );

  if (!dataset) return <DatasetLoader progress={progress} error={error} />;

  const set = (patch: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setLimit(PAGE_SIZE);
  };

  const togglePosition = (position: string) =>
    set({
      positions: filters.positions.includes(position)
        ? filters.positions.filter((p) => p !== position)
        : [...filters.positions, position],
    });

  const toggleLeague = (league: string) =>
    set({
      leagues: filters.leagues.includes(league)
        ? filters.leagues.filter((l) => l !== league)
        : [...filters.leagues, league],
    });

  const activeFilterCount =
    filters.positions.length +
    filters.leagues.length +
    (filters.nationality !== "all" ? 1 : 0) +
    (filters.minAge !== DEFAULT_FILTERS.minAge || filters.maxAge !== DEFAULT_FILTERS.maxAge ? 1 : 0) +
    (filters.minPace > 0 ? 1 : 0) +
    (filters.minShooting > 0 ? 1 : 0);

  return (
    <div className="pt-12 pb-10">
      <SectionHead
        eyebrow={`${datasetInfo.count.toLocaleString()} profiles · ${datasetInfo.clubs} clubs · ${datasetInfo.nations} nations`}
        title="Player database"
        blurb="Search and filter the full FC 26 attribute set. Every card renders from the same 34-column source the model was trained on."
      />

      <div className="grid gap-8 lg:grid-cols-[264px_1fr]">
        {/* ------------------------------------------------------ filters */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="label-xs">Filters {activeFilterCount > 0 && `· ${activeFilterCount}`}</p>
              <button
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setQuery("");
                }}
                className="label-xs text-faint transition-colors hover:text-a"
              >
                Reset
              </button>
            </div>

            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Name, club, nation…"
              className="mb-6 w-full rounded-lg border border-line bg-void/60 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-a/60"
            />

            <FilterGroup label="Position">
              <div className="flex flex-wrap gap-1.5">
                {dataset.positions.map((position) => (
                  <Chip
                    key={position}
                    active={filters.positions.includes(position)}
                    color="var(--color-a)"
                    onClick={() => togglePosition(position)}
                  >
                    {position}
                  </Chip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup label={`Overall ${filters.minOverall}–${filters.maxOverall}`}>
              <Range label="Min" value={filters.minOverall} min={55} max={91} onChange={(v) => set({ minOverall: v })} />
              <div className="h-3" />
              <Range label="Max" value={filters.maxOverall} min={55} max={99} onChange={(v) => set({ maxOverall: v })} />
            </FilterGroup>

            <FilterGroup label={`Age ${filters.minAge}–${filters.maxAge}`}>
              <Range label="Min" value={filters.minAge} min={16} max={44} onChange={(v) => set({ minAge: v })} />
              <div className="h-3" />
              <Range label="Max" value={filters.maxAge} min={16} max={44} onChange={(v) => set({ maxAge: v })} />
            </FilterGroup>

            <FilterGroup label="Minimum group rating">
              <Range label="Pace" value={filters.minPace} min={0} max={99} onChange={(v) => set({ minPace: v })} />
              <div className="h-3" />
              <Range label="Shooting" value={filters.minShooting} min={0} max={99} onChange={(v) => set({ minShooting: v })} />
            </FilterGroup>

            <FilterGroup label="League">
              <select
                value=""
                onChange={(e) => e.target.value && toggleLeague(e.target.value)}
                className="mb-2 w-full rounded-lg border border-line bg-void/60 px-3 py-2 text-[12px] text-muted outline-none focus:border-a/60"
              >
                <option value="">Add league…</option>
                {dataset.leagues.map((league) => (
                  <option key={league} value={league} disabled={filters.leagues.includes(league)}>
                    {league}
                  </option>
                ))}
              </select>
              {filters.leagues.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {filters.leagues.map((league) => (
                    <Chip key={league} active onClick={() => toggleLeague(league)}>
                      {league} ✕
                    </Chip>
                  ))}
                </div>
              )}
            </FilterGroup>

            <FilterGroup label="Nationality">
              <select
                value={filters.nationality}
                onChange={(e) => set({ nationality: e.target.value })}
                className="w-full rounded-lg border border-line bg-void/60 px-3 py-2 text-[12px] text-muted outline-none focus:border-a/60"
              >
                <option value="all">All nations</option>
                {dataset.nations.map((nation) => (
                  <option key={nation} value={nation}>
                    {nation}
                  </option>
                ))}
              </select>
            </FilterGroup>
          </div>
        </aside>

        {/* ------------------------------------------------------- results */}
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <p className="num text-[12px] text-muted">
              <span className="text-ink">{results.length.toLocaleString()}</span> match
              {results.length === 1 ? "" : "es"}
              {results.length > limit && <span className="text-faint"> · showing {limit}</span>}
            </p>
            <div className="flex flex-wrap gap-1">
              {SORTS.map((option) => (
                <Chip key={option.key} active={sort === option.key} onClick={() => setSort(option.key)}>
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>

          {results.length === 0 ? (
            <Empty
              title="No players match those filters"
              hint="Widen the overall or age range, or clear the position and league selections."
            />
          ) : (
            <>
              <motion.div layout className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {results.slice(0, limit).map((player, i) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    href={`/players/${player.id}`}
                    index={i}
                    accent={i % 2 === 0 ? "a" : "b"}
                  />
                ))}
              </motion.div>

              {limit < results.length && (
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={() => setLimit((l) => l + PAGE_SIZE)}
                    className="rounded-full border border-line px-7 py-3 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase transition-colors hover:border-a/50 hover:text-ink"
                  >
                    Load {Math.min(PAGE_SIZE, results.length - limit)} more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 border-t border-line-soft pt-5 first:border-0 first:pt-0">
      <p className="label-xs mb-3">{label}</p>
      {children}
    </div>
  );
}

