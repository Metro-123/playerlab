export const A = "#22d3ee";
export const B = "#a3e635";

export const accent = {
  a: A,
  aSoft: "rgba(34,211,238,0.14)",
  aLine: "rgba(34,211,238,0.4)",
  b: B,
  bSoft: "rgba(163,230,53,0.14)",
  bLine: "rgba(163,230,53,0.4)",
};

export const ink = "#f2f5f9";
export const muted = "#8a94a6";
export const faint = "#5b6474";
export const line = "#1e232e";
export const panel = "#101319";

export const series = {
  pace: "#22d3ee",
  shooting: "#fb7185",
  passing: "#a3e635",
  dribbling: "#c084fc",
  defending: "#fbbf24",
  physical: "#60a5fa",
  goalkeeping: "#f472b6",
} as const;

export type SeriesKey = keyof typeof series;

export const groupColor: Record<string, string> = series;

/** Rating -> colour ramp. Deliberately narrow: only the top of the scale glows. */
export function ratingColor(value: number, min = 45, max = 96): string {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const stops: Array<[number, [number, number, number]]> = [
    [0, [51, 65, 85]],
    [0.45, [56, 89, 122]],
    [0.7, [34, 211, 238]],
    [0.88, [163, 230, 53]],
    [1, [250, 250, 210]],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const k = (t - lo[0]) / span;
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function deltaColor(delta: number, deadband = 1): string {
  if (Math.abs(delta) <= deadband) return muted;
  return delta > 0 ? "#a3e635" : "#fb7185";
}
