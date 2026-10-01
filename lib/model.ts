import modelJson from "@/data/model.json";
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes } from "./types";
import type { Dataset, Player } from "./dataset";

export interface ModelFeature {
  key: string;
  label: string;
  group: string;
  mean: number;
  std: number;
  /** Standardised coefficient. */
  coef: number;
  /** Change in predicted overall per +1 point of this attribute. */
  perPoint: number;
}

export interface ModelSegment {
  label: string;
  n: number;
  alpha: number;
  positions: string[];
  features: ModelFeature[];
  positionIntercepts: Record<string, number>;
  intercept: number;
  positionStats: Record<string, { n: number; mean: number; median: number; min: number; max: number }>;
  metrics: {
    cv: { r2: number; mae: number; rmse: number; within1: number };
    inSample: { r2: number; mae: number; rmse: number };
    baselines: Record<string, { mae: number; r2: number }>;
    alphaSearch: Array<{ alpha: number; mae: number; r2: number }>;
    folds: number;
  };
  residuals: Array<{ id: number; r: number }>;
}

export interface ModelFile {
  name: string;
  kind: string;
  target: string;
  trainedAt: string;
  dataset: {
    name: string;
    season: string;
    synthetic: boolean;
    players: number;
    source: string;
    minOverall: number;
  };
  segments: { outfield: ModelSegment; goalkeepers: ModelSegment };
  groupValidation: Record<
    string,
    { mae: number; median: number; p95: number; within1: number }
  >;
  diagnostics: Array<{ features: string; cvR2: number; cvMae: number; note: string }>;
}

export const model = modelJson as unknown as ModelFile;

export const OUTFIELD = model.segments.outfield;
export const GOALKEEPERS = model.segments.goalkeepers;

const outfieldFeatures = new Map<string, ModelFeature>();
const keeperFeatures = new Map<string, ModelFeature>();
for (const feature of OUTFIELD.features) outfieldFeatures.set(feature.key, feature);
for (const feature of GOALKEEPERS.features) keeperFeatures.set(feature.key, feature);

/** Each segment has its own coefficient set; never mix them. */
function featuresFor(isGk: boolean): Map<string, ModelFeature> {
  return isGk ? keeperFeatures : outfieldFeatures;
}

export function isGoalkeeper(player: Player): boolean {
  return player.position === "GK";
}

export function segmentFor(player: Player): ModelSegment {
  return isGoalkeeper(player) ? GOALKEEPERS : OUTFIELD;
}

function positionIntercept(segment: ModelSegment, position: string): number {
  return segment.positionIntercepts[position] ?? segment.intercept;
}

/* ------------------------------------------------------------ prediction */

export interface Contribution {
  key: AttributeKey;
  label: string;
  group: string;
  /** Standardised deviation from the training mean. */
  z: number;
  /** Contribution to the predicted overall, in rating points. */
  points: number;
}

export interface Prediction {
  value: number;
  baseline: number;
  segment: ModelSegment;
  contributions: Contribution[];
}

/**
 * Exact additive prediction. `contributions` sums to (value - baseline) with no
 * residual error, because the model is linear in the attributes. This identity
 * is what the attribution charts and the What-If Lab rely on.
 */
export function predictRaw(attributes: Attributes, position: string, isGk: boolean): number {
  const segment = isGk ? GOALKEEPERS : OUTFIELD;
  const features = featuresFor(isGk);
  let value = positionIntercept(segment, position);
  for (const key of ATTRIBUTE_KEYS) {
    const feature = features.get(key);
    if (!feature) continue;
    value += (feature.coef * (attributes[key] - feature.mean)) / feature.std;
  }
  return value;
}

export function predict(attributes: Attributes, position: string, isGk: boolean): Prediction {
  const segment = isGk ? GOALKEEPERS : OUTFIELD;
  const features = featuresFor(isGk);
  const baseline = positionIntercept(segment, position);
  const contributions: Contribution[] = [];
  let value = baseline;

  for (const key of ATTRIBUTE_KEYS) {
    const feature = features.get(key);
    if (!feature) continue;
    const z = (attributes[key] - feature.mean) / feature.std;
    const points = feature.coef * z;
    value += points;
    contributions.push({ key, label: feature.label, group: feature.group, z, points });
  }

  contributions.sort((a, b) => b.points - a.points);
  return { value, baseline, segment, contributions };
}

export function predictPlayer(player: Player): Prediction {
  return predict(player.attributes, player.position, isGoalkeeper(player));
}

/* ------------------------------------------------------------ importance */

export interface AttributeImpact {
  key: AttributeKey;
  label: string;
  group: string;
  perPoint: number;
  /** Observed spread of this attribute across the segment. */
  spread: number;
  /** |perPoint| * spread: how much overall the attribute can actually move. */
  influence: number;
  perPointMin: number;
  perPointMax: number;
}

function spreadOf(dataset: Dataset, key: AttributeKey, isGk: boolean): { min: number; max: number; range: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const player of dataset.players) {
    if ((player.position === "GK") !== isGk) continue;
    const value = player.attributes[key];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min)) return { min: 0, max: 0, range: 0 };
  return { min, max, range: max - min };
}

export function attributeImpacts(dataset: Dataset, isGk = false): AttributeImpact[] {
  const segment = isGk ? GOALKEEPERS : OUTFIELD;
  return segment.features
    .map((feature) => {
      const { min, max, range } = spreadOf(dataset, feature.key as AttributeKey, isGk);
      return {
        key: feature.key as AttributeKey,
        label: feature.label,
        group: feature.group,
        perPoint: feature.perPoint,
        spread: range,
        perPointMin: feature.perPoint * min,
        perPointMax: feature.perPoint * max,
        influence: Math.abs(feature.perPoint) * range,
      };
    })
    .sort((a, b) => b.influence - a.influence);
}

export function groupInfluence(dataset: Dataset, isGk = false) {
  const impacts = attributeImpacts(dataset, isGk);
  const totals = new Map<string, number>();
  for (const item of impacts) totals.set(item.group, (totals.get(item.group) ?? 0) + item.influence);
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([group, influence]) => ({
      group,
      influence,
      share: total === 0 ? 0 : influence / total,
    }))
    .sort((a, b) => b.influence - a.influence);
}

/* ----------------------------------------------------------- calibration */

const residualById = new Map<number, number>();
for (const segment of [OUTFIELD, GOALKEEPERS]) {
  for (const entry of segment.residuals) residualById.set(entry.id, entry.r);
}

export interface Calibration {
  residual: number;
  label: string;
  tone: "good" | "warn" | "bad";
  note: string;
  percentile: number;
}

/**
 * residual = published overall − out-of-fold prediction. Positive means the
 * game awards more than the attribute profile alone explains.
 */
export function calibration(player: Player): Calibration {
  const residual = residualById.get(player.id) ?? 0;
  let rank = 0;
  for (const value of residualById.values()) if (value < residual) rank++;
  const percentile = Math.round((rank / residualById.size) * 100);

  if (residual >= 1.5) {
    return {
      residual,
      percentile,
      label: "Under-valued",
      tone: "warn",
      note: "The game awards more than these attributes imply. Form, role or condition are doing work the attribute sheet cannot show.",
    };
  }
  if (residual <= -1.5) {
    return {
      residual,
      percentile,
      label: "Over-valued",
      tone: "bad",
      note: "The rating sits above what the attribute profile supports. Look at the weakest contributing attributes below.",
    };
  }
  return {
    residual,
    percentile,
    label: "Calibrated",
    tone: "good",
    note: "Rating and attribute profile agree.",
  };
}

/* ------------------------------------------------------------- analysis */

export interface ModelSummary {
  /** Size of the analysed segment. Every count below is relative to this. */
  total: number;
  meanSignedError: number;
  meanAbsoluteError: number;
  withinOne: number;
  withinTwo: number;
  overValued: number;
  underValued: number;
  calibrated: number;
  largestGaps: Array<{ id: number; name: string; position: string; overall: number; predicted: number; residual: number }>;
  byPosition: Array<{ position: string; n: number; bias: number }>;
}

export function modelSummary(dataset: Dataset, isGk = false): ModelSummary {
  const subset = dataset.players.filter((p) => (p.position === "GK") === isGk);
  const rows = subset.map((p) => {
    const predicted = predictRaw(p.attributes, p.position, isGk);
    return { p, predicted, residual: p.overall - predicted };
  });
  const abs = rows.map((r) => Math.abs(r.residual));
  const at = (fn: (r: (typeof rows)[number]) => boolean) => rows.filter(fn).length;

  const byPositionMap = new Map<string, number[]>();
  for (const row of rows) {
    const list = byPositionMap.get(row.p.position) ?? [];
    list.push(row.residual);
    byPositionMap.set(row.p.position, list);
  }

  return {
    total: rows.length,
    meanSignedError: rows.reduce((a, r) => a + r.residual, 0) / rows.length,
    meanAbsoluteError: abs.reduce((a, b) => a + b, 0) / abs.length,
    withinOne: at((r) => Math.abs(r.residual) <= 1) / rows.length,
    withinTwo: at((r) => Math.abs(r.residual) <= 2) / rows.length,
    overValued: at((r) => r.residual <= -1.5),
    underValued: at((r) => r.residual >= 1.5),
    calibrated: at((r) => Math.abs(r.residual) < 1.5),
    largestGaps: [...rows]
      .sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual))
      .slice(0, 8)
      .map((r) => ({
        id: r.p.id,
        name: r.p.displayName,
        position: r.p.position,
        overall: r.p.overall,
        predicted: +r.predicted.toFixed(1),
        residual: +r.residual.toFixed(2),
      })),
    byPosition: [...byPositionMap.entries()]
      .map(([position, list]) => ({
        position,
        n: list.length,
        bias: +(list.reduce((a, b) => a + b, 0) / list.length).toFixed(3),
      }))
      .sort((a, b) => a.bias - b.bias),
  };
}

/** A player's own z-scores against the training distribution. */
export function profile(dataset: Dataset, player: Player, limit = 4) {
  const segment = segmentFor(player);
  const scored = segment.features
    .map((feature) => ({
      key: feature.key as AttributeKey,
      label: feature.label,
      group: feature.group,
      value: player.attributes[feature.key as AttributeKey],
      z: (player.attributes[feature.key as AttributeKey] - feature.mean) / feature.std,
    }))
    .sort((a, b) => b.z - a.z);

  const stats = segment.positionStats[player.position];
  const peers = dataset.players.filter((p) => p.position === player.position);
  const below = peers.filter((p) => p.overall < player.overall).length;

  return {
    strengths: scored.slice(0, limit),
    weaknesses: scored.slice(-limit).reverse(),
    positionStats: stats,
    percentileInPosition: peers.length === 0 ? 50 : Math.round((below / peers.length) * 100),
  };
}

/** Nearest neighbours on the six published group ratings, same position first. */
export function similarPlayers(dataset: Dataset, player: Player, limit = 6): Player[] {
  const keys = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"] as const;
  const target = keys.map((k) => player.groups[k]);
  const distance = (p: Player) =>
    Math.sqrt(keys.reduce((sum, key, i) => sum + (p.groups[key] - target[i]) ** 2, 0));

  return dataset.players
    .filter((p) => p.id !== player.id && (p.position === player.position || p.altPositions.includes(player.position)))
    .map((p) => ({ p, d: distance(p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}
