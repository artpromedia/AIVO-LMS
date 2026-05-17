"use client";

import { useEffect, useState } from "react";
import { DistrictOverview } from "../../../../components/enterprise/DistrictOverview";

interface DistrictSummary {
  id: string;
  name: string;
  metrics: {
    schools: number;
    teachers: number;
    learners: number;
    activeRosterImportStatus?: "idle" | "running" | "completed" | "failed";
    lastImportAt?: string;
    dpaStatus?: "accepted" | "missing";
    dpaVersion?: string;
    auditEventCounts?: Record<string, number>;
    profileRecommendationApprovals?: number;
  };
}

/**
 * Sprint 08 district enterprise overview. Mounted at
 * /dashboard/district/enterprise so the existing district dashboard is
 * preserved untouched.
 */
export default function DistrictEnterprisePage() {
  const [summary, setSummary] = useState<DistrictSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/districts/current/overview");
        if (!res.ok) {
          setError(`Failed to load district overview (${res.status}).`);
          return;
        }
        setSummary((await res.json()) as DistrictSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load district overview.");
      }
    })();
  }, []);

  return (
    <main className="district-enterprise-page mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold">District enterprise</h1>
        <p className="text-sm text-gray-600">Hierarchy, rosters, and compliance.</p>
      </header>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {summary ? (
        <>
          <DistrictOverview
            district={{ id: summary.id, name: summary.name }}
            metrics={summary.metrics}
          />
          <section className="rounded border p-4 text-sm">
            <h2 className="text-lg font-semibold">Compliance summary</h2>
            <ul className="mt-2 list-disc pl-5">
              <li>
                DPA: {summary.metrics.dpaStatus ?? "unknown"}
                {summary.metrics.dpaVersion ? ` (version ${summary.metrics.dpaVersion})` : ""}
              </li>
              <li>
                Profile recommendation approvals (last 30d):{" "}
                {summary.metrics.profileRecommendationApprovals ?? 0}
              </li>
              <li>
                Audit events:{" "}
                {Object.values(summary.metrics.auditEventCounts ?? {}).reduce((a, b) => a + b, 0)}
              </li>
            </ul>
          </section>
          <nav className="flex flex-wrap gap-2 text-sm">
            <a className="rounded border px-3 py-1.5" href="/dashboard/district/enterprise/schools">
              Schools
            </a>
            <a className="rounded border px-3 py-1.5" href="/dashboard/district/enterprise/rosters">
              Rosters
            </a>
            <a className="rounded border px-3 py-1.5" href="/dashboard/district/compliance">
              Compliance
            </a>
          </nav>
        </>
      ) : (
        !error && <p>Loading…</p>
      )}
    </main>
  );
}
