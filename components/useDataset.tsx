"use client";

import { useEffect, useState } from "react";
import { loadDataset, onLoadProgress, type Dataset, type LoadProgress } from "@/lib/dataset";
import { datasetInfo } from "@/lib/info";

export interface DatasetState {
  dataset: Dataset | null;
  /** `null` until the payload's total size is known. */
  progress: LoadProgress;
  error: Error | null;
}

export function useDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>({ dataset: null, progress: 0, error: null });

  useEffect(() => {
    let alive = true;
    const off = onLoadProgress((progress) => {
      if (alive) setState((s) => ({ ...s, progress }));
    });
    loadDataset()
      .then((dataset) => {
        if (alive) setState({ dataset, progress: 1, error: null });
      })
      .catch((error: Error) => {
        if (alive) setState((s) => ({ ...s, error }));
      });
    return () => {
      alive = false;
      off();
    };
  }, []);

  return state;
}

/** Branded loading state shown while the columnar payload streams in. */
export function DatasetLoader({ progress, error }: { progress: LoadProgress; error: Error | null }) {
  const determinate = typeof progress === "number";
  const pct = determinate ? Math.min(100, Math.round((progress as number) * 100)) : 0;
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 28 28" className="h-9 w-9">
          <defs>
            <linearGradient id="load-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-a)" />
              <stop offset="100%" stopColor="var(--color-b)" />
            </linearGradient>
          </defs>
          <circle cx="14" cy="14" r="11" fill="none" stroke="#1e232e" strokeWidth="1.4" />
          {determinate ? (
            <circle
              cx="14"
              cy="14"
              r="11"
              fill="none"
              stroke="url(#load-g)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 69.1} 69.1`}
              transform="rotate(-90 14 14)"
              style={{ transition: "stroke-dasharray 0.25s linear" }}
            />
          ) : (
            <circle
              cx="14"
              cy="14"
              r="11"
              fill="none"
              stroke="url(#load-g)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray="17 69.1"
              transform="rotate(-90 14 14)"
              style={{ animation: "spin 1.05s linear infinite" }}
            />
          )}
        </svg>
        <p className="label-xs">Loading {datasetInfo.count.toLocaleString()} player profiles</p>
      </div>
      <div className="h-px w-56 overflow-hidden" style={{ background: "#1e232e" }}>
        {determinate ? (
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--color-a), var(--color-b))",
            }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--color-a), var(--color-b), transparent)",
              animation: "load-sweep 1.25s ease-in-out infinite",
            }}
          />
        )}
      </div>
      <p className="num text-[10px] text-faint">{determinate ? `${pct}%` : "streaming"}</p>
      {error && (
        <p className="max-w-sm text-center text-[11px] text-bad">
          Failed to load the dataset ({error.message}). Run{" "}
          <code className="text-ink">node scripts/convert-fc26.mjs</code> to regenerate it.
        </p>
      )}
    </div>
  );
}
