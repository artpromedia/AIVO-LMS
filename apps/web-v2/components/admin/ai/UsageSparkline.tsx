interface UsagePoint {
  date: string;
  calls: number;
  tokens: number;
  costUsd: number;
}

interface UsageSparklineProps {
  series: UsagePoint[];
}

/**
 * Inline SVG sparkline of `calls` over time plus totals. Server component.
 */
export function UsageSparkline({ series }: UsageSparklineProps) {
  if (!series || series.length === 0) {
    return <p className="text-sm text-aivo-ink-soft">No usage data</p>;
  }

  const width = 320;
  const height = 64;
  const max = Math.max(...series.map((p) => p.calls), 1);
  const stepX = series.length > 1 ? width / (series.length - 1) : 0;

  const points = series
    .map((p, i) => {
      const x = i * stepX;
      const y = height - (p.calls / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const totalCalls = series.reduce((s, p) => s + p.calls, 0);
  const totalTokens = series.reduce((s, p) => s + p.tokens, 0);
  const totalCost = series.reduce((s, p) => s + p.costUsd, 0);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full text-aivo-primary"
        preserveAspectRatio="none"
        role="img"
        aria-label="Calls over time"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">Calls</p>
          <p className="font-display font-semibold tabular-nums">{totalCalls.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">Tokens</p>
          <p className="font-display font-semibold tabular-nums">{totalTokens.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">Cost</p>
          <p className="font-display font-semibold tabular-nums">${totalCost.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
