import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import {
  slaFor,
  formatRemaining,
  tenantName,
  type Dsar,
  type DsarStatus,
  type SlaState,
} from "@/lib/compliance/governance-store";

function statusTone(s: DsarStatus): "success" | "warning" | "neutral" | "danger" {
  if (s === "fulfilled") return "success";
  if (s === "rejected") return "danger";
  if (s === "approved" || s === "fulfilling") return "warning";
  return "neutral";
}

function slaColor(state: SlaState): string {
  if (state === "overdue") return "text-aivo-danger font-semibold";
  if (state === "due_soon") return "text-amber-600 font-semibold";
  if (state === "met") return "text-aivo-success";
  return "text-aivo-ink-soft";
}

export function DsarQueueTable({
  dsars,
  detailBase,
}: {
  dsars: Dsar[];
  /** e.g. "/admin/platform/compliance/dsar" */
  detailBase: string;
}) {
  if (dsars.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="No DSAR requests"
        description="No requests match the current filter."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-aivo-border">
      <table className="w-full text-sm">
        <thead className="bg-aivo-surface-2 text-left">
          <tr>
            <th className="p-3 font-semibold">Type</th>
            <th className="p-3 font-semibold">Subject</th>
            <th className="p-3 font-semibold">Regulation</th>
            <th className="p-3 font-semibold">Tenant</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold">SLA</th>
            <th className="p-3 font-semibold">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {dsars.map((d) => {
            const sla = slaFor(d);
            return (
              <tr
                key={d.id}
                className="border-t border-aivo-border hover:bg-aivo-surface-2 transition"
              >
                <td className="p-3 capitalize">
                  <Link
                    href={`${detailBase}/${d.id}`}
                    className="font-medium text-iw-primary hover:underline"
                  >
                    {d.type}
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs">{d.subjectId}</td>
                <td className="p-3 uppercase font-mono text-xs">{d.regulation}</td>
                <td className="p-3 text-xs text-aivo-ink-soft">{tenantName(d.tenantId)}</td>
                <td className="p-3">
                  <Badge tone={statusTone(d.status)}>{d.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className={`p-3 text-xs ${slaColor(sla.state)}`}>
                  {sla.state === "met" ? "Met" : formatRemaining(sla.fulfillmentRemainingMs)}
                  {sla.ackOverdue && <span className="ml-1 text-aivo-danger">(ack overdue)</span>}
                </td>
                <td className="p-3 text-xs text-aivo-ink-soft">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
