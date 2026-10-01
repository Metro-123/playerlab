import manifest from "@/data/manifest.json";

export const datasetInfo = {
  name: manifest.name,
  season: manifest.season,
  synthetic: manifest.synthetic,
  source: manifest.source,
  updated: manifest.updated,
  minOverall: manifest.minOverall,
  /** Static counts, available before the payload is fetched. */
  count: manifest.count,
  positions: manifest.positions,
  leagues: manifest.leagues,
  clubs: manifest.clubs,
  nations: manifest.nations,
  topOvr: manifest.topOvr,
  medianOvr: manifest.medianOvr,
};

/** Whether to render portraits hotlinked from the source CDN. */
export const USE_FACES = process.env.NEXT_PUBLIC_USE_FACES !== "false";

export const CDN = "https://cdn.sofifa.net";

/** Portrait asset build on the source CDN (FC 26). Size is appended as `_120`. */
export const FACE_VERSION = "26";

/**
 * Portraits are served through our own origin rather than hotlinked: the CDN
 * answers 403 to any request without a `Referer: https://sofifa.com/` header,
 * which a browser `<img>` tag can never send. `s` picks the CDN asset size;
 * 120 is published for every player, 240 only for some.
 */
export function faceUrl(id: number, size: 60 | 120 | 240 = 120): string {
  return size === 120 ? `/api/face/${id}` : `/api/face/${id}?s=${size}`;
}
