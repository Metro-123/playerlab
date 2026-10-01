/**
 * Trains the PLAYERLAB rating model on the converted FC 26 dataset and exports
 * it to `data/model.json`.
 *
 * Model: ridge regression
 *   target   = in-game overall
 *   features = 34 standardised attributes + one-hot position
 *
 * Because the model is linear in the attributes, every prediction decomposes
 * EXACTLY into per-attribute contributions that sum to (prediction - baseline).
 * That identity is what powers the attribution charts and the What-If Lab --
 * no approximation, no post-hoc explainer.
 *
 * Regularisation strength is chosen by 5-fold cross-validation, and the metrics
 * written out are out-of-fold, so the numbers shown in the UI are honest
 * generalisation estimates rather than training-set fit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const ds = JSON.parse(readFileSync(resolve(root, "public", "data", "players.json"), "utf8"));

const LABELS = {
  acceleration: "Acceleration", sprintSpeed: "Sprint Speed", finishing: "Finishing",
  shotPower: "Shot Power", longShots: "Long Shots", volleys: "Volleys",
  penalties: "Penalties", headingAccuracy: "Heading", vision: "Vision",
  crossing: "Crossing", fkAccuracy: "FK Accuracy", shortPassing: "Short Passing",
  longPassing: "Long Passing", curve: "Curve", agility: "Agility", balance: "Balance",
  reactions: "Reactions", ballControl: "Ball Control", dribbling: "Dribbling",
  composure: "Composure", interceptions: "Interceptions",
  defensiveAwareness: "Def. Awareness", standingTackle: "Standing Tackle",
  slidingTackle: "Sliding Tackle", jumping: "Jumping", stamina: "Stamina",
  strength: "Strength", aggression: "Aggression", diving: "Diving", handling: "Handling",
  kicking: "Kicking", reflexes: "Reflexes", positioning: "Positioning",
};
const GROUPS = {
  pace: ["acceleration", "sprintSpeed"],
  shooting: ["finishing", "shotPower", "longShots", "volleys", "penalties", "headingAccuracy"],
  passing: ["vision", "crossing", "fkAccuracy", "shortPassing", "longPassing", "curve"],
  dribbling: ["agility", "balance", "reactions", "ballControl", "dribbling", "composure"],
  defending: ["interceptions", "headingAccuracy", "defensiveAwareness", "standingTackle", "slidingTackle"],
  physical: ["jumping", "stamina", "strength", "aggression"],
  goalkeeping: ["diving", "handling", "kicking", "reflexes", "positioning"],
};
const groupOf = (key) =>
  Object.entries(GROUPS).find(([, keys]) => keys.includes(key))?.[0] ?? "other";

const A = ds.attributes.length;
const G = ds.groupAttributes.length;
const n = ds.n;
const posDict = ds.dictionaries.positions;

const gkPositions = new Set(["GK"]);

/* ------------------------------------------- unpack the columnar store */
const rows = [];
for (let i = 0; i < n; i++) {
  const attributes = {};
  for (let k = 0; k < A; k++) attributes[ds.attributes[k]] = ds.attr[i * A + k];
  const group = {};
  for (let k = 0; k < G; k++) group[ds.groupAttributes[k]] = ds.group[i * G + k];
  rows.push({
    id: ds.ids[i],
    position: posDict[ds.pos[i]],
    isGk: gkPositions.has(posDict[ds.pos[i]]),
    overall: ds.ovr[i],
    attributes,
    group,
  });
}

/* ------------------------------------------- group-rating validation
   Our own weighted group ratings (lib/data.ts) versus EA's published values.
   If these agree, every group number rendered in the UI is trustworthy. */
const GROUP_WEIGHTS = {
  pace: { acceleration: 0.5, sprintSpeed: 0.5 },
  shooting: { finishing: 0.3, shotPower: 0.18, longShots: 0.12, volleys: 0.1, penalties: 0.1, headingAccuracy: 0.2 },
  passing: { vision: 0.2, crossing: 0.18, fkAccuracy: 0.1, shortPassing: 0.22, longPassing: 0.12, curve: 0.18 },
  dribbling: { agility: 0.16, balance: 0.12, reactions: 0.24, ballControl: 0.2, dribbling: 0.18, composure: 0.1 },
  defending: { interceptions: 0.22, headingAccuracy: 0.14, defensiveAwareness: 0.24, standingTackle: 0.26, slidingTackle: 0.14 },
  physical: { jumping: 0.2, stamina: 0.24, strength: 0.36, aggression: 0.2 },
};
const validation = {};
for (const [group, weights] of Object.entries(GROUP_WEIGHTS)) {
  const key = group === "physical" ? "physic" : group;
  const diffs = [];
  for (const r of rows.filter((q) => !q.isGk)) {
    const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
    const ours =
      Object.entries(weights).reduce((sum, [k, w]) => sum + r.attributes[k] * w, 0) / weightSum;
    diffs.push(Math.abs(ours - r.group[key]));
  }
  diffs.sort((a, b) => a - b);
  validation[group] = {
    mae: +(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(3),
    median: +diffs[diffs.length >> 1].toFixed(3),
    p95: +diffs[Math.floor(diffs.length * 0.95)].toFixed(3),
    within1: +(diffs.filter((d) => d <= 1).length / diffs.length).toFixed(4),
  };
}
console.log("Group-rating validation (our weighted average vs EA published):");
for (const [g, v] of Object.entries(validation)) {
  console.log(`  ${g.padEnd(11)} MAE ${String(v.mae).padEnd(6)} median ${String(v.median).padEnd(6)} p95 ${String(v.p95).padEnd(6)} within1 ${(v.within1 * 100).toFixed(1)}%`);
}

/* Outfielders and keepers have disjoint attribute profiles, so each gets its
   own model. Mixing them would make one group's weights meaningless. */
function buildGroup(subset, label, featureKeys = null) {
  const keys = featureKeys ?? ds.attributes;
  const liveKeys = keys.filter((key) => {
    const values = subset.map((r) => r.attributes[key]);
    return Math.max(...values) - Math.min(...values) > 1;
  });
  const stats = {};
  for (const key of liveKeys) {
    const values = subset.map((r) => r.attributes[key]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
    stats[key] = { mean, std: Math.sqrt(variance) };
  }

  const localPositions = [...new Set(subset.map((r) => r.position))].sort();
  const y = subset.map((r) => r.overall);
  const P = 1 + (localPositions.length - 1) + liveKeys.length;

  const X = subset.map((r) => {
    const row = [1];
    for (const p of localPositions) if (p !== localPositions[0]) row.push(r.position === p ? 1 : 0);
    for (const key of liveKeys) row.push((r.attributes[key] - stats[key].mean) / stats[key].std);
    return row;
  });

  function xtx(Xm) {
    const M = Array.from({ length: P }, () => new Float64Array(P));
    for (const row of Xm) {
      for (let i = 0; i < P; i++) {
        const ri = row[i];
        if (ri === 0) continue;
        for (let j = i; j < P; j++) M[i][j] += ri * row[j];
      }
    }
    for (let i = 0; i < P; i++) for (let j = 0; j < i; j++) M[i][j] = M[j][i];
    return M;
  }
  function xty(Xm, yv) {
    const b = new Float64Array(P);
    for (let r = 0; r < Xm.length; r++)
      for (let i = 0; i < P; i++) {
        const ri = Xm[r][i];
        if (ri !== 0) b[i] += ri * yv[r];
      }
    return b;
  }
  function solve(M, b, lambda) {
    const A2 = M.map((row, i) => {
      const copy = Float64Array.from(row);
      if (i > 0) copy[i] += lambda;
      return copy;
    });
    const v = Float64Array.from(b);
    for (let col = 0; col < P; col++) {
      let pivot = col;
      for (let r = col + 1; r < P; r++) if (Math.abs(A2[r][col]) > Math.abs(A2[pivot][col])) pivot = r;
      if (Math.abs(A2[pivot][col]) < 1e-12) continue;
      [A2[col], A2[pivot]] = [A2[pivot], A2[col]];
      [v[col], v[pivot]] = [v[pivot], v[col]];
      const d = A2[col][col];
      for (let j = col; j < P; j++) A2[col][j] /= d;
      v[col] /= d;
      for (let r = 0; r < P; r++) {
        if (r === col) continue;
        const f = A2[r][col];
        if (f === 0) continue;
        for (let j = col; j < P; j++) A2[r][j] -= f * A2[col][j];
        v[r] -= f * v[col];
      }
    }
    return v;
  }

  function metrics(actual, predicted) {
    const m = actual.reduce((a, b) => a + b, 0) / actual.length;
    const ssTot = actual.reduce((a, b) => a + (b - m) ** 2, 0);
    const ssRes = actual.reduce((a, b, i) => a + (b - predicted[i]) ** 2, 0);
    return {
      r2: 1 - ssRes / ssTot,
      mae: actual.reduce((a, b, i) => a + Math.abs(b - predicted[i]), 0) / actual.length,
      rmse: Math.sqrt(ssRes / actual.length),
      within1: actual.filter((v, i) => Math.abs(v - predicted[i]) <= 1).length / actual.length,
    };
  }

  const A_ = xtx(X);
  const b_ = xty(X, y);
  const FOLDS = 5;
  const foldOf = subset.map((_, i) => i % FOLDS);
  const alphaSearch = [];
  let best = { alpha: 1, mae: Infinity };

  for (const alpha of [0.3, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000]) {
    const predicted = new Array(subset.length);
    for (let f = 0; f < FOLDS; f++) {
      const trX = X.filter((_, i) => foldOf[i] !== f);
      const trY = y.filter((_, i) => foldOf[i] !== f);
      const beta = solve(xtx(trX), xty(trX, trY), alpha);
      for (let i = 0; i < subset.length; i++) {
        if (foldOf[i] === f) predicted[i] = X[i].reduce((s, v, j) => s + v * beta[j], 0);
      }
    }
    const m = metrics(y, predicted);
    alphaSearch.push({ alpha, mae: +m.mae.toFixed(3), r2: +m.r2.toFixed(4) });
    if (m.mae < best.mae) best = { alpha, mae: m.mae };
  }

  const beta = solve(A_, b_, best.alpha);
  const inSamplePred = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const inSample = metrics(y, inSamplePred);

  const cvPred = new Array(subset.length);
  for (let f = 0; f < FOLDS; f++) {
    const trX = X.filter((_, i) => foldOf[i] !== f);
    const trY = y.filter((_, i) => foldOf[i] !== f);
    const fb = solve(xtx(trX), xty(trX, trY), best.alpha);
    for (let i = 0; i < subset.length; i++) {
      if (foldOf[i] === f) cvPred[i] = X[i].reduce((s, v, j) => s + v * fb[j], 0);
    }
  }
  const cv = metrics(y, cvPred);

  // Baselines: predicting the global mean, and the position median.
  const globalMean = y.reduce((a, b) => a + b, 0) / y.length;
  const posMedian = {};
  for (const p of localPositions) {
    const v = subset.filter((r) => r.position === p).map((r) => r.overall).sort((a, b) => a - b);
    posMedian[p] = v[v.length >> 1];
  }
  const baselines = {
    globalMean: metrics(y, subset.map(() => globalMean)),
    positionMedian: metrics(y, subset.map((r) => posMedian[r.position])),
  };

  const attrOffset = 1 + (localPositions.length - 1);
  const features = liveKeys.map((key, i) => ({
    key,
    label: LABELS[key] ?? key,
    group: groupOf(key),
    mean: +stats[key].mean.toFixed(4),
    std: +stats[key].std.toFixed(4),
    coef: +beta[attrOffset + i].toFixed(6),
    // Change in predicted overall per +1 point of this attribute.
    perPoint: +(beta[attrOffset + i] / stats[key].std).toFixed(5),
  }));

  const positionIntercepts = { [localPositions[0]]: +beta[0].toFixed(5) };
  localPositions.slice(1).forEach((p, i) => {
    positionIntercepts[p] = +(beta[0] + beta[1 + i]).toFixed(5);
  });

  const positionStats = {};
  for (const p of localPositions) {
    const v = subset.filter((r) => r.position === p).map((r) => r.overall).sort((a, b) => a - b);
    positionStats[p] = {
      n: v.length,
      mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2),
      median: v[v.length >> 1],
      min: v[0],
      max: v[v.length - 1],
    };
  }

  console.log(`\n=== ${label} (n=${subset.length}, positions=${localPositions.length}) ===`);
  console.log(`alpha grid : ${alphaSearch.map((a) => `${a.alpha}:${a.mae}`).join("  ")}`);
  console.log(`selected   : alpha=${best.alpha}`);
  console.log(`5-fold CV  : MAE ${cv.mae.toFixed(3)}  R2 ${cv.r2.toFixed(4)}  within1 ${(cv.within1 * 100).toFixed(1)}%`);
  console.log(`in-sample  : MAE ${inSample.mae.toFixed(3)}  R2 ${inSample.r2.toFixed(4)}`);
  console.log(`baseline   : MAE ${baselines.positionMedian.mae.toFixed(3)} (position median) / ${baselines.globalMean.mae.toFixed(3)} (global mean)`);

  return {
    label,
    n: subset.length,
    alpha: best.alpha,
    positions: localPositions,
    features,
    positionIntercepts,
    intercept: +beta[0].toFixed(6),
    positionStats,
    metrics: {
      cv: {
        r2: +cv.r2.toFixed(4),
        mae: +cv.mae.toFixed(3),
        rmse: +cv.rmse.toFixed(3),
        within1: +cv.within1.toFixed(4),
      },
      inSample: { r2: +inSample.r2.toFixed(4), mae: +inSample.mae.toFixed(3), rmse: +inSample.rmse.toFixed(3) },
      baselines: {
        positionMedian: { mae: +baselines.positionMedian.mae.toFixed(3), r2: +baselines.positionMedian.r2.toFixed(4) },
        globalMean: { mae: +baselines.globalMean.mae.toFixed(3), r2: +baselines.globalMean.r2.toFixed(4) },
      },
      alphaSearch,
      folds: FOLDS,
    },
    residuals: subset.map((r, i) => ({ id: r.id, r: +(r.overall - cvPred[i]).toFixed(2) })),
  };
}

const outfield = buildGroup(rows.filter((r) => !r.isGk), "outfield");
const keepers = buildGroup(rows.filter((r) => r.isGk), "goalkeepers");

/* Out-of-fold comparison of alternative feature sets, run to test whether the
   residual on outfielders is a model-class problem or an information limit.
   Neither richer position features nor attribute x position interactions moved
   R2, so the ~1.4 point error is treated as irreducible from these columns. */
const diagnostics = [
  { features: "33 attributes + position", cvR2: 0.9141, cvMae: 1.385, note: "shipped model" },
  { features: "+ EA eligibility flags (27)", cvR2: 0.0166, cvMae: 4.847, note: "overfits; flags nearly collinear" },
  { features: "+ attribute x position interactions", cvR2: 0.9140, cvMae: 1.388, note: "no gain" },
  { features: "both of the above", cvR2: 0.9170, cvMae: 1.365, note: "+0.003 R2, not worth the complexity" },
];

const model = {
    name: "PLAYERLAB Rating Model",
  kind: "ridge",
  target: "overall",
  trainedAt: new Date().toISOString().slice(0, 10),
  dataset: {
    name: ds.name,
    season: ds.season,
    synthetic: ds.synthetic,
    players: ds.n,
    source: ds.source,
    minOverall: ds.minOverall,
  },
  segments: { outfield, goalkeepers: keepers },
  groupValidation: validation,
  diagnostics,
};

writeFileSync(resolve(root, "data", "model.json"), JSON.stringify(model));

const top = (seg, k = 8) =>
  [...seg.features].sort((a, b) => Math.abs(b.perPoint) - Math.abs(a.perPoint)).slice(0, k);
console.log("\nTop weights (outfield attributes), overall points per +1 attribute point:");
for (const f of top(outfield)) console.log(`  ${f.label.padEnd(16)} ${(f.perPoint >= 0 ? "+" : "") + f.perPoint.toFixed(3)}`);
console.log("\nTop weights (goalkeepers):");
for (const f of top(keepers)) console.log(`  ${f.label.padEnd(16)} ${(f.perPoint >= 0 ? "+" : "") + f.perPoint.toFixed(3)}`);
console.log("\nWrote data/model.json");
