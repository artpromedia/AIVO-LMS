import { Card } from "@/components/ui/card";
import type { SloBudget } from "@/lib/services/status-page-svc";

export function BudgetBurnChart({ budgets }: { budgets: SloBudget[] }) {
  if (budgets.length === 0) {
    return <p className="text-sm text-iw-ink-muted">No SLO budgets reported.</p>;
  }
  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <p className="font-iw-display text-base font-semibold text-iw-ink">Error budget burn</p>
      <ul className="mt-4 space-y-4">
        {budgets.map((b) => {
          const frac = Math.max(0, Math.min(1, b.consumedFraction));
          const over = b.consumedFraction > 1;
          const fillClass = over
            ? "bg-aivo-danger"
            : frac >= 0.75
              ? "bg-aivo-warning"
              : "bg-aivo-success";
          return (
            <li key={b.sloId}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-iw-ink">{b.service}</span>
                <span className="tabular-nums text-iw-ink-muted">
                  {Math.round((over ? 1 : frac) * 100)}% consumed
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-iw-card border border-iw-border">
                <div
                  className={`h-full ${fillClass}`}
                  style={{ width: `${(over ? 1 : frac) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
