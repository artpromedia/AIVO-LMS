/**
 * District audit export & integrity console (Sprint B4).
 *
 * The FERPA/SOC2 answer in product form: filter the district's
 * hash-chained trail by date range and action, preview exactly what the
 * download will contain (same filters, same source), export as CSV or
 * JSONL (the export itself lands on the audit log), and verify the
 * hash chain over the selected range server-side.
 */
import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminCard, AdminPageFrame, DataTable } from "@aivo/admin-ui";
import {
  listDistrictActivity,
  verifyDistrictActivityChain,
  type DistrictChainVerification,
} from "@/lib/district-activity";
import { formatDateTime } from "@/components/admin-format";

const PAGE_SIZE = 20;

interface ExportSearchParams {
  page?: string;
  from?: string;
  to?: string;
  action?: string;
  verify?: string;
}

function downloadHref(format: "csv" | "json", params: ExportSearchParams): string {
  const qs = new URLSearchParams({ format });
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.action) qs.set("action", params.action);
  return `/district/audit/download?${qs}`;
}

export default async function DistrictAuditExportPage({
  searchParams,
}: {
  searchParams: Promise<ExportSearchParams>;
}) {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = params.from?.trim() || undefined;
  const to = params.to?.trim() || undefined;
  const action = params.action?.trim() || undefined;

  const [preview, verification] = await Promise.all([
    listDistrictActivity(session, { page, pageSize: PAGE_SIZE, from, to, action }),
    params.verify === "1"
      ? verifyDistrictActivityChain(session, { from, to })
      : Promise.resolve<DistrictChainVerification | null>(null),
  ]);

  return (
    <AdminPageFrame
      eyebrow="District · Audit"
      title="Export & verify"
      description="Download your district's audit trail and prove its integrity with hash-chain verification."
      action={
        <Link className="admin-button admin-button-secondary" href="/district/audit">
          Back to audit log
        </Link>
      }
    >
      <AdminCard className="mt-8 p-6">
        <h2 className="text-xl font-black">Filters</h2>
        <form action="/district/audit/export" method="get" className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block text-sm font-semibold text-slate-600">
            From
            <input className="admin-input" type="date" name="from" defaultValue={from ?? ""} />
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            To
            <input className="admin-input" type="date" name="to" defaultValue={to ?? ""} />
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Action
            <input
              className="admin-input"
              type="text"
              name="action"
              defaultValue={action ?? ""}
              placeholder="e.g. admin.learner.viewed"
            />
          </label>
          <button className="admin-button-secondary" type="submit">
            Apply filters
          </button>
        </form>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a className="admin-button" href={downloadHref("csv", params)} data-testid="district-export-csv">
            Export CSV
          </a>
          <a
            className="admin-button-secondary"
            href={downloadHref("json", params)}
            data-testid="district-export-jsonl"
          >
            Export JSONL
          </a>
          <form action="/district/audit/export" method="get" className="inline">
            {from ? <input type="hidden" name="from" value={from} /> : null}
            {to ? <input type="hidden" name="to" value={to} /> : null}
            {action ? <input type="hidden" name="action" value={action} /> : null}
            <input type="hidden" name="verify" value="1" />
            <button className="admin-button-secondary" type="submit" data-testid="district-verify">
              Verify integrity
            </button>
          </form>
          <span className="text-sm text-slate-500">
            Every export is itself recorded on the audit trail.
          </span>
        </div>
      </AdminCard>

      {verification ? (
        <AdminCard className="mt-6 p-6" testId="district-verify-result">
          {verification.intact ? (
            <div>
              <h2 className="text-xl font-black text-green-700">Chain intact</h2>
              <p className="mt-2 text-sm text-slate-700">
                {verification.checkedRows.toLocaleString()} entr
                {verification.checkedRows === 1 ? "y" : "ies"} re-hashed
                {verification.from || verification.to ? " in the selected range" : ""} — every
                stored hash matches its recomputed value
                {verification.anchored
                  ? " and the range is anchored to the entry immediately before it."
                  : "."}
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-black text-red-700">Integrity break detected</h2>
              <p className="mt-2 text-sm text-slate-700">
                Verification failed at chain position{" "}
                <span className="font-mono font-bold">#{verification.brokenAtSeq}</span> after{" "}
                {verification.checkedRows.toLocaleString()} verified entries. Entries at and after
                this position cannot be trusted — contact AIVO support with this position number.
              </p>
            </div>
          )}
          <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <strong>How this works:</strong> every audit entry stores a cryptographic fingerprint
            (SHA-256 hash) of its own content combined with the fingerprint of the entry before
            it, forming a chain. Changing, inserting, or deleting any past entry changes its
            fingerprint and breaks every link after it. Verification recomputes the whole selected
            range from the raw entries and compares against the stored fingerprints — so a clean
            result is mathematical evidence the trail has not been altered.
          </p>
        </AdminCard>
      ) : null}

      <h2 className="mt-8 text-xl font-black">Preview</h2>
      <p className="mt-1 text-sm text-slate-600">
        The download contains exactly these entries ({preview.total.toLocaleString()} total).
      </p>
      <div className="mt-4">
        <DataTable
          columns={[
            {
              key: "createdAt",
              header: "When",
              render: (row) => <span className="text-sm">{formatDateTime(row.createdAt)}</span>,
            },
            {
              key: "action",
              header: "Action",
              render: (row) => <span className="font-mono text-xs font-bold">{row.action}</span>,
            },
            {
              key: "actor",
              header: "Actor",
              render: (row) => (
                <span className="text-sm">{row.actorName ?? row.actorId.slice(0, 8)}</span>
              ),
            },
            {
              key: "resource",
              header: "Resource",
              render: (row) => (
                <span className="text-sm">
                  {row.resourceType}
                  {row.resourceId ? (
                    <span className="block font-mono text-xs text-slate-500">{row.resourceId}</span>
                  ) : null}
                </span>
              ),
            },
          ]}
          rows={preview.rows}
          rowKey={(row) => row.id}
          total={preview.total}
          page={preview.page}
          pageSize={preview.pageSize}
          basePath="/district/audit/export"
          extraParams={{ from, to, action }}
          emptyMessage="No activity in this range."
          searchable={false}
        />
      </div>
    </AdminPageFrame>
  );
}
