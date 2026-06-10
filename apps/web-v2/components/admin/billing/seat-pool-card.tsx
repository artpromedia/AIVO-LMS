import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SeatPoolCardProps {
  total: number;
  allocated: number;
  used: number;
  unallocated: number;
  status: "active" | "past_due" | "trialing" | "canceled";
  renewalDate: string;
  plan: string;
  mrrCents: number;
  arrCents: number;
  currency: string;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  trialing: "warning",
  past_due: "danger",
  canceled: "neutral",
};

export function SeatPoolCard({
  total,
  allocated,
  used,
  unallocated,
  status,
  renewalDate,
  plan,
  mrrCents,
  arrCents,
  currency,
}: SeatPoolCardProps) {
  const utilizationPct = total > 0 ? Math.round((used / total) * 100) : 0;
  const allocationPct = total > 0 ? Math.round((allocated / total) * 100) : 0;

  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Seat Pool</p>
          <p className="mt-0.5 font-display text-lg font-semibold capitalize">{plan}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status}</Badge>
          <span className="text-xs text-aivo-ink-soft">
            Renews {new Date(renewalDate).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-aivo-ink-soft">Total seats</p>
          <p className="font-display text-2xl font-bold">{total}</p>
        </div>
        <div>
          <p className="text-xs text-aivo-ink-soft">Allocated</p>
          <p className="font-display text-2xl font-bold">{allocated}</p>
        </div>
        <div>
          <p className="text-xs text-aivo-ink-soft">Used</p>
          <p className="font-display text-2xl font-bold">{used}</p>
        </div>
        <div>
          <p className="text-xs text-aivo-ink-soft">Unallocated</p>
          <p className="font-display text-2xl font-bold">{unallocated}</p>
        </div>
      </div>

      <div className="mb-2 space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-xs text-aivo-ink-soft">
            <span>Allocation ({allocationPct}%)</span>
            <span>
              {allocated} / {total}
            </span>
          </div>
          <Progress value={allocationPct} aria-label={`${allocationPct}% of seats allocated`} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-aivo-ink-soft">
            <span>Utilization ({utilizationPct}%)</span>
            <span>
              {used} / {total}
            </span>
          </div>
          <Progress
            value={utilizationPct}
            aria-label={`${utilizationPct}% of seats in use`}
            className={utilizationPct > 90 ? "[&>div]:bg-aivo-danger" : ""}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-6 border-t border-aivo-border pt-4">
        <div>
          <p className="text-xs text-aivo-ink-soft">MRR</p>
          <p className="font-semibold">{formatMoney(mrrCents, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-aivo-ink-soft">ARR</p>
          <p className="font-semibold">{formatMoney(arrCents, currency)}</p>
        </div>
      </div>
    </Card>
  );
}
