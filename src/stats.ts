export type LatencyStats = {
  count: number;
  min_ms: number | null;
  max_ms: number | null;
  avg_ms: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    throw new Error("percentile on empty set");
  }
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function summarizeLatencies(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return {
      count: 0,
      min_ms: null,
      max_ms: null,
      avg_ms: null,
      p50_ms: null,
      p95_ms: null,
      p99_ms: null,
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);

  return {
    count: sorted.length,
    min_ms: Number(sorted[0].toFixed(3)),
    max_ms: Number(sorted[sorted.length - 1].toFixed(3)),
    avg_ms: Number((sum / sorted.length).toFixed(3)),
    p50_ms: Number(percentile(sorted, 50).toFixed(3)),
    p95_ms: Number(percentile(sorted, 95).toFixed(3)),
    p99_ms: Number(percentile(sorted, 99).toFixed(3)),
  };
}
