"use client";

import { DistrictDpaPanel } from "../../../../components/data-governance/DistrictDpaPanel";
import { AuditReportPanel } from "../../../../components/data-governance/AuditReportPanel";

/**
 * Sprint 09 district compliance page. Shows DPA status, audit event
 * counts, and links to deeper compliance reports.
 */
export default function DistrictCompliancePage() {
  return (
    <main className="district-compliance-page mx-auto max-w-3xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold">District compliance</h1>
        <p className="text-sm text-gray-600">
          DPA acceptance, audit summary, and data-governance status.
        </p>
      </header>
      <DistrictDpaPanel districtId="current" />
      <AuditReportPanel />
    </main>
  );
}
