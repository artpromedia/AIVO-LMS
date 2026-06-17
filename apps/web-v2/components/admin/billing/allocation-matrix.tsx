import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface SchoolAllocationRow {
  schoolId: string;
  schoolName: string;
  allocated: number;
  used: number;
}

interface AllocationMatrixProps {
  allocations: SchoolAllocationRow[];
  unallocated: number;
  total: number;
}

export function AllocationMatrix({ allocations, unallocated, total }: AllocationMatrixProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-aivo-border px-4 py-3">
        <h3 className="font-display text-base font-semibold">School Allocations</h3>
        <span className="text-xs text-aivo-ink-soft">
          {unallocated} of {total} seats unallocated
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-iw-raised text-left">
          <tr>
            <th className="p-3">School</th>
            <th className="p-3 text-right">Allocated</th>
            <th className="p-3 text-right">Used</th>
            <th className="p-3 text-right">Utilization</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {allocations.map((row) => {
            const pct = row.allocated > 0 ? Math.round((row.used / row.allocated) * 100) : 0;
            const overUtilized = row.used > row.allocated;
            return (
              <tr
                key={row.schoolId}
                className={`border-t border-iw-border ${overUtilized ? "bg-iw-error/5" : ""}`}
              >
                <td className="p-3 font-medium">{row.schoolName}</td>
                <td className="p-3 text-right tabular-nums">{row.allocated}</td>
                <td className="p-3 text-right tabular-nums">{row.used}</td>
                <td className="p-3 text-right tabular-nums">{pct}%</td>
                <td className="p-3 text-right">
                  {overUtilized ? (
                    <Badge tone="danger">Over limit</Badge>
                  ) : pct >= 90 ? (
                    <Badge tone="warning">Near limit</Badge>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {allocations.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-sm text-aivo-ink-soft">
                No school allocations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
