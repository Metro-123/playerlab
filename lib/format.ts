export function signed(value: number, digits = 1): string {
  const v = value.toFixed(digits);
  return value > 0 ? `+${v}` : v;
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function seasonLabel(index: number, count: number, season = "26"): string {
  const startSeason = Number(season) - (count - 1);
  return `${String(startSeason + index).slice(-2)}/${String((startSeason + index + 1) % 100).padStart(2, "0")}`;
}

export function heightLabel(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
}

export function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Deterministic 0..1 from a string, for stable per-player variation. */
export function hashUnit(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
