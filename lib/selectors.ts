import type { Dataset, Player } from "./dataset";
import { percentileInPosition } from "./dataset";
import type { AttributeKey, GroupShort } from "./types";

export interface FilterState {
  query: string;
  positions: string[];
  leagues: string[];
  nationality: string;
  minOverall: number;
  maxOverall: number;
  minAge: number;
  maxAge: number;
  minPace: number;
  minShooting: number;
  maxOverallStrict: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  query: "",
  positions: [],
  leagues: [],
  nationality: "all",
  minOverall: 55,
  maxOverall: 99,
  minAge: 16,
  maxAge: 44,
  minPace: 0,
  minShooting: 0,
  maxOverallStrict: false,
};

/** Diacritic- and accent-insensitive matching so "Mbappe" finds "Mbappé". */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function applyFilters(dataset: Dataset, filters: FilterState): Player[] {
  const query = fold(filters.query.trim());
  const terms = query.length > 0 ? query.split(/\s+/) : [];
  const positionSet = new Set(filters.positions);
  const leagueSet = new Set(filters.leagues);

  return dataset.players.filter((player) => {
    if (player.overall < filters.minOverall || player.overall > filters.maxOverall) return false;
    if (player.age < filters.minAge || player.age > filters.maxAge) return false;
    if (positionSet.size > 0 && !positionSet.has(player.position)) return false;
    if (leagueSet.size > 0 && !leagueSet.has(player.league)) return false;
    if (filters.nationality !== "all" && player.nationality !== filters.nationality) return false;
    if (filters.minPace > 0 && player.groups.PAC < filters.minPace) return false;
    if (filters.minShooting > 0 && player.groups.SHO < filters.minShooting) return false;

    if (terms.length > 0) {
      const haystack = fold(
        `${player.displayName} ${player.club} ${player.nationality} ${player.position} ${player.altPositions.join(" ")}`,
      );
      for (const term of terms) {
        if (!haystack.includes(term)) return false;
      }
    }
    return true;
  });
}

export function sortPlayers(players: Player[], key: string): Player[] {
  const copy = [...players];
  switch (key) {
    case "name":
      return copy.sort((a, b) => a.displayName.localeCompare(b.displayName));
    case "age":
      return copy.sort((a, b) => a.age - b.age);
    case "value":
      return copy.sort((a, b) => b.valueEur - a.valueEur);
    case "wage":
      return copy.sort((a, b) => b.wageEur - a.wageEur);
    case "potential":
      return copy.sort((a, b) => b.potential - a.overall || b.overall - a.overall);
    case "height":
      return copy.sort((a, b) => b.heightCm - a.heightCm);
    default:
      return copy.sort((a, b) => b.overall - a.overall);
  }
}

/* ------------------------------------------------------------- selectors */

export function percentileRows(dataset: Dataset, player: Player) {
  return (Object.keys(player.attributes) as AttributeKey[]).map((key) => ({
    key,
    value: player.attributes[key],
    percentile: percentileInPosition(dataset, player, key),
  }));
}

export function spreadByPosition(dataset: Dataset, key: GroupShort) {
  const values = dataset.players.map((p) => p.groups[key]);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function topBy(dataset: Dataset, n: number, predicate?: (p: Player) => boolean) {
  return dataset.players
    .filter((p) => (predicate ? predicate(p) : true))
    .slice(0, n);
}

export function formatValue(eur: number): string {
  if (eur <= 0) return "Free";
  if (eur >= 1e9) return `€${(eur / 1e9).toFixed(2)}B`;
  if (eur >= 1e6) return `€${(eur / 1e6).toFixed(1)}M`;
  if (eur >= 1e3) return `€${(eur / 1e3).toFixed(0)}K`;
  return `€${eur}`;
}

export function formatWage(eur: number): string {
  if (eur <= 0) return "—";
  if (eur >= 1e6) return `€${(eur / 1e6).toFixed(2)}M/w`;
  return `€${(eur / 1e3).toFixed(0)}K/w`;
}

export function heightLabel(cm: number): string {
  if (!cm) return "—";
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - Math.max(0, 5 - n));
}
