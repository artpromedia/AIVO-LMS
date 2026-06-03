import { EmptyState } from "@/components/ui/empty-state";

interface Metrics {
  safety: number;
  accuracy: number;
  bias: number;
  refusalRate: number;
  hallucination: number;
}

interface EvalResultsChartProps {
  metrics: Metrics | null;
}

// For these metrics, lower is better — render with a warning tone.
const LOWER_IS_BETTER = new Set<keyof Metrics>(["refusalRate", "hallucination"]);

const LABELS: Record<keyof Metrics, string> = {
  safety: "Safety",
  accuracy: "Accuracy",
  bias: "Bias",
  refusalRate: "Refusal rate",
  hallucination: "Hallucination",
};

/**
 * Horizontal CSS bars for eval metrics (0..1 scaled to width%). No external
 * chart libs. Server component.
 */
export function EvalResultsChart({ metrics }: EvalResultsChartProps) {
  if (!metrics) {
    return (
      <EmptyState title="No eval results yet" description="This run has not produced metrics." />
    );
  }

  const rows = (Object.keys(LABELS) as (keyof Metrics)[]).map((key) => ({
    key,
    label: LABELS[key],
    value: metrics[key],
    warn: LOWER_IS_BETTER.has(key),
  }));

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = Math.max(0, Math.min(1, row.value)) * 100;
        return (
          <div key={row.key}>
            <div className="flex items-center justify-between text-xs">
              <span>{row.label}</span>
              <span className="tabular-nums text-aivo-ink-soft">{row.value.toFixed(3)}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-aivo-surface-2">
              <div
                className={`h-full rounded-full ${row.warn ? "bg-aivo-warning" : "bg-aivo-success"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
