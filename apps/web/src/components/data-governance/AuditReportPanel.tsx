"use client";

import { useEffect, useState } from "react";

export interface AuditReportPanelProps {
  fetchImpl?: typeof fetch;
}

export function AuditReportPanel({ fetchImpl = fetch }: AuditReportPanelProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchImpl("/api/audit-reports/counts-by-action");
        if (!res.ok) {
          setError(`Failed to load audit report (${res.status}).`);
          return;
        }
        const data = (await res.json()) as { counts?: Record<string, number> };
        setCounts(data.counts ?? {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit report.");
      }
    })();
  }, [fetchImpl]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <section className="audit-report-panel rounded border p-4">
      <h3 className="text-lg font-semibold">Audit summary</h3>
      <p className="text-xs text-gray-600">Aggregated counts by action (no raw payloads).</p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {total === 0 && !error ? (
        <p className="mt-2 text-sm text-gray-600">No audit events yet.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1">Action</th>
              <th className="text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([action, count]) => (
              <tr key={action} className="border-b last:border-0">
                <td className="py-1">{action}</td>
                <td className="text-right">{count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="py-1 text-left">Total</th>
              <th className="text-right">{total}</th>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

export default AuditReportPanel;
