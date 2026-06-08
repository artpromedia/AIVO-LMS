import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type AdminReportDefinition,
  type AdminReportResult,
  listReportDefinitions,
  runReport,
} from "@aivo/admin-api/reports";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

function ReportResultTable({ result }: { result: AdminReportResult }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              {result.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {result.columns.map((column) => {
                  const value = row[column];
                  return (
                    <td className="text-sm" key={column}>
                      {value === null || value === undefined ? "—" : String(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {result.rows.length === 0 ? (
              <tr>
                <td
                  className="py-10 text-center text-slate-500"
                  colSpan={Math.max(result.columns.length, 1)}
                >
                  This report returned no rows.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

function ReportCatalog({
  definitions,
  basePath,
  schoolId,
  activeReportId,
}: {
  definitions: AdminReportDefinition[];
  basePath: string;
  schoolId?: string;
  activeReportId?: string;
}) {
  const schoolQuery = schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : "";
  return (
    <nav className="mt-8 flex flex-wrap gap-2">
      {definitions.map((definition) => (
        <Link
          className={`admin-filter ${
            activeReportId === definition.id ? "admin-filter-active" : ""
          }`}
          href={`${basePath}?reportId=${encodeURIComponent(definition.id)}${schoolQuery}`}
          key={definition.id}
        >
          {definition.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function SchoolReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reportId?: string; schoolId?: string }>;
}) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const params = await searchParams;
  const schoolId = params.schoolId?.trim() || session.tenantId;

  let definitions: AdminReportDefinition[] = [];
  let loadError: string | null = null;
  try {
    definitions = await listReportDefinitions(session, schoolId);
  } catch (error) {
    loadError = error instanceof AdminApiError ? error.message : "Failed to load reports.";
  }

  const activeReportId = definitions.find((d) => d.id === params.reportId)?.id;
  const activeDefinition = definitions.find((d) => d.id === activeReportId);

  let result: AdminReportResult | null = null;
  let runError: string | null = null;
  if (activeReportId) {
    try {
      result = await runReport(session, schoolId, activeReportId);
    } catch (error) {
      runError = error instanceof AdminApiError ? error.message : "Failed to run report.";
    }
  }

  return (
    <AdminPageFrame
      eyebrow="School"
      title="Reports"
      description="Operational reports for your school. Some figures are estimated until a source-of-record dataset lands."
    >
      {loadError ? <p className="admin-error mt-5">{loadError}</p> : null}

      <ReportCatalog
        definitions={definitions}
        basePath="/school/reports"
        schoolId={params.schoolId?.trim() || undefined}
        activeReportId={activeReportId}
      />

      {!activeReportId ? (
        <AdminCard className="mt-6">
          <p className="text-sm text-slate-500">Select a report above to run it.</p>
        </AdminCard>
      ) : null}

      {activeDefinition ? (
        <div className="mt-6">
          <h2 className="text-xl font-black">{activeDefinition.label}</h2>
          {activeDefinition.description ? (
            <p className="mt-1 text-sm text-slate-500">{activeDefinition.description}</p>
          ) : null}
          {activeDefinition.estimated || result?.estimated ? (
            <p className="admin-notice mt-3">
              These figures are estimated, not read from a source-of-record table.
            </p>
          ) : null}
        </div>
      ) : null}

      {runError ? <p className="admin-error mt-5">{runError}</p> : null}
      {result ? <ReportResultTable result={result} /> : null}
    </AdminPageFrame>
  );
}
