import {
  GROUP_SHORTS,
  type AttributeKey,
  type Attributes,
  type GroupShort,
} from "./types";
import { faceUrl } from "./info";

/* ------------------------------------------------------------------ types */

export interface ColumnarPayload {
  name: string;
  season: string;
  synthetic: boolean;
  source: string;
  updated: string;
  minOverall: number;
  attributes: string[];
  groupAttributes: string[];
  dictionaries: {
    positions: string[];
    nations: string[];
    leagues: string[];
    clubs: string[];
  };
  n: number;
  ids: number[];
  names: string[];
  shortNames: string[];
  pos: number[];
  alt: number[][];
  age: number[];
  nat: number[];
  lg: number[];
  cl: number[];
  height: number[];
  weight: number[];
  foot: number[];
  weakFoot: number[];
  skillMoves: number[];
  ovr: number[];
  potential: number[];
  valueEur: number[];
  wageEur: number[];
  reputation: number[];
  /** Flat n x 33 block, row-major. */
  attr: number[];
  /** Flat n x 6 block of EA's published group ratings. */
  group: number[];
}

export interface Player {
  index: number;
  id: number;
  name: string;
  displayName: string;
  shortName: string;
  position: string;
  altPositions: string[];
  age: number;
  nationality: string;
  league: string;
  club: string;
  heightCm: number;
  weightKg: number;
  foot: "L" | "R";
  weakFoot: number;
  skillMoves: number;
  overall: number;
  potential: number;
  valueEur: number;
  wageEur: number;
  reputation: number;
  faceUrl: string;
  attributes: Attributes;
  /** EA's own published group ratings, used verbatim. */
  groups: Record<GroupShort, number>;
  /**
   * False for goalkeepers: EA publishes no PAC/SHO/PAS/DRI/DEF/PHY for them and
   * the source column is 0, not an omitted field. Consumers must check this
   * rather than render a group rating of 0.
   */
  hasGroupRatings: boolean;
}

export interface Dataset {
  payload: ColumnarPayload;
  players: Player[];
  byId: Map<number, Player>;
  attributes: AttributeKey[];
  attributeIndex: Map<AttributeKey, number>;
  positions: string[];
  leagues: string[];
  clubs: string[];
  nations: string[];
  /** positionSlot -> Int16Array[attributeIndex] of sorted in-position values. */
  percentiles: Map<number, Int16Array[]>;
  loadProgress: number;
}

/* --------------------------------------------------------------- display */

/**
 * The source exports both a full legal name and an abbreviated short name.
 * Neither reads well on a card: "Jude Victor William Bellingham" is a registry
 * name and "J. Bellingham" is an abbreviation. When the short name starts with
 * an initial, expand it from the first token of the full name; otherwise the
 * short name is already the commonly used form ("Rodri").
 */
export function deriveDisplayName(fullName: string, shortName: string): string {
  const short = shortName.trim();
  const m = short.match(/^([A-ZÀ-Ý])\.\s*(.+)$/);
  if (m) {
    const first = fullName.trim().split(/\s+/)[0];
    if (first && /^[A-Za-zÀ-ÿ'’-]{2,}$/.test(first)) return `${first} ${m[2]}`;
  }
  return short.replace(/\.\s*/g, " ").trim() || fullName;
}

/* ------------------------------------------------------------ hydration */

const GROUP_KEY_BY_SHORT: Record<GroupShort, string> = {
  PAC: "pace",
  SHO: "shooting",
  PAS: "passing",
  DRI: "dribbling",
  DEF: "defending",
  PHY: "physic",
};

export function hydrate(payload: ColumnarPayload, loadProgress = 1): Dataset {
  const A = payload.attributes.length;
  const attributes = payload.attributes as AttributeKey[];
  const attributeIndex = new Map(attributes.map((k, i) => [k, i]));
  const { positions: posDict, nations, leagues, clubs } = payload.dictionaries;

  const players: Player[] = new Array(payload.n);
  for (let i = 0; i < payload.n; i++) {
    const attrs = {} as Attributes;
    const base = i * A;
    for (let k = 0; k < A; k++) attrs[attributes[k]] = payload.attr[base + k];

    const gBase = i * payload.groupAttributes.length;
    const groups = {} as Record<GroupShort, number>;
    for (const short of GROUP_SHORTS) {
      const key = GROUP_KEY_BY_SHORT[short];
      const gi = payload.groupAttributes.indexOf(key);
      groups[short] = gi === -1 ? 0 : payload.group[gBase + gi];
    }
    const position = posDict[payload.pos[i]];

    players[i] = {
      index: i,
      id: payload.ids[i],
      name: payload.names[i],
      displayName: deriveDisplayName(payload.names[i], payload.shortNames[i]),
      shortName: payload.shortNames[i],
      position,
      altPositions: payload.alt[i].map((p) => posDict[p]),
      age: payload.age[i],
      nationality: nations[payload.nat[i]],
      league: leagues[payload.lg[i]],
      club: clubs[payload.cl[i]],
      heightCm: payload.height[i],
      weightKg: payload.weight[i],
      foot: payload.foot[i] === 1 ? "L" : "R",
      weakFoot: payload.weakFoot[i],
      skillMoves: payload.skillMoves[i],
      overall: payload.ovr[i],
      potential: payload.potential[i],
      valueEur: payload.valueEur[i],
      wageEur: payload.wageEur[i],
      reputation: payload.reputation[i],
      faceUrl: faceUrl(payload.ids[i]),
      attributes: attrs,
      groups,
      hasGroupRatings: position !== "GK",
    };
  }

  return {
    payload,
    players,
    byId: new Map(players.map((p) => [p.id, p])),
    attributes,
    attributeIndex,
    positions: [...new Set(players.map((p) => p.position))].sort(),
    leagues: [...new Set(players.map((p) => p.league))].sort(),
    clubs: [...new Set(players.map((p) => p.club))].sort(),
    nations: [...new Set(players.map((p) => p.nationality))].sort(),
    percentiles: buildPercentileTables(players),
    loadProgress,
  };
}

/* ----------------------------------------------------------- percentiles */

/**
 * Per-position sorted attribute columns, so a percentile lookup is a binary
 * search over ~1-3k values instead of a scan across all 17k players.
 * Indexed as positionSlot -> Int16Array[attributeIndex].
 */
function buildPercentileTables(players: Player[]): Map<number, Int16Array[]> {
  const positionOrder = [...new Set(players.map((p) => p.position))].sort();
  const buckets = new Map<string, Player[]>();
  for (const player of players) {
    let list = buckets.get(player.position);
    if (!list) buckets.set(player.position, (list = []));
    list.push(player);
  }

  const attributeKeys = Object.keys(players[0]?.attributes ?? {}) as AttributeKey[];
  const table = new Map<number, Int16Array[]>();

  positionOrder.forEach((position, slot) => {
    const list = buckets.get(position)!;
    const columns: Int16Array[] = [];
    for (const key of attributeKeys) {
      const sorted = list.map((p) => p.attributes[key]).sort((a, b) => a - b);
      columns.push(Int16Array.from(sorted));
    }
    table.set(slot, columns);
  });

  void attributeKeys;
  return table;
}

export function percentileInPosition(dataset: Dataset, player: Player, key: AttributeKey): number | null {
  const ai = dataset.attributeIndex.get(key);
  if (ai === undefined) return null;
  const slot = dataset.positions.indexOf(player.position);
  if (slot < 0) return null;
  const column = dataset.percentiles.get(slot)?.[ai];
  if (!column) return null;
  // Sorted ascending by construction, so binary search directly.
  const value = player.attributes[key];
  let low = 0;
  let high = column.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (column[mid] < value) low = mid + 1;
    else high = mid;
  }
  return Math.round((low / column.length) * 100);
}

/* --------------------------------------------------------------- loader */

let cache: Dataset | null = null;
let inflight: Promise<Dataset> | null = null;
const listeners = new Set<(progress: LoadProgress) => void>();

/** Reported to progress listeners; `null` means the total size is unknown. */
export type LoadProgress = number | null;

export function onLoadProgress(fn: (progress: LoadProgress) => void): () => void {
  listeners.add(fn);
  if (cache) fn(1);
  return () => listeners.delete(fn);
}

export function loadDataset(url = "/data/players.json"): Promise<Dataset> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load dataset: ${response.status}`);

    /**
     * A compressed response has no usable content-length: the header describes
     * the encoded body, and CDN edges serving brotli frequently omit it
     * entirely. Rather than divide by zero and pin the bar at 0% for the whole
     * download, report `null` so the UI can show an indeterminate state.
     */
    const declared = Number(response.headers.get("content-length") ?? 0);
    const total = declared > 0 ? declared : 0;
    const report = (loaded: number) => {
      const progress = total > 0 ? loaded / total : null;
      for (const fn of listeners) fn(progress);
    };

    let payload: ColumnarPayload;
    if (response.body && typeof ReadableStream !== "undefined") {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        report(loaded);
      }
      const merged = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      payload = JSON.parse(new TextDecoder().decode(merged));
    } else {
      payload = await response.json();
    }

    const dataset = hydrate(payload, 1);
    for (const fn of listeners) fn(1);
    cache = dataset;
    return dataset;
  })();

  inflight.catch(() => {
    inflight = null;
  });
  return inflight;
}

export function getCachedDataset(): Dataset | null {
  return cache;
}

/** Test seam. */
export function __setDataset(dataset: Dataset | null): void {
  cache = dataset;
  inflight = null;
}
