import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SloBudget } from "@/lib/services/status-page-svc";

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

type Health = "healthy" | "at_risk" | "breaching";

function healthOf(budget: SloBudget): Health {
  if (budget.remaining <= 0) return "breaching";
  if (budget.burnRate >= 1) return "at_risk";
  return "healthy";
}

const HEALTH_TONE: Record<Health, "success" | "warning" | "danger"> = {
  healthy: "success",
  at_risk: "warning",
  breaching: "danger",
};

const HEALTH_LABEL: Record<Health, string> = {
  healthy: "Healthy",
  at_risk: "At risk",
  breaching: "Breaching",
};

export function SloCard({ budget }: { budget: SloBudget }) {
  const health = healthOf(budget);
  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-iw-display text-base font-semibold text-iw-ink">{budget.service}</p>
          <p className="text-xs text-iw-ink-muted">
            Target {pct(budget.target)} · {budget.windowDays}d window
          </p>
        </div>
        <Badge tone={HEALTH_TONE[health]}>{HEALTH_LABEL[health]}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">Observed SLI</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{pct(budget.observedSli)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">Budget remaining</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {Math.max(0, Math.round((1 - budget.consumedFraction) * 100))}%
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">Burn rate</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{budget.burnRate.toFixed(2)}×</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">To exhaustion</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {Number.isFinite(budget.hoursToExhaustion)
              ? `${Math.round(budget.hoursToExhaustion)}h`
              : "—"}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
