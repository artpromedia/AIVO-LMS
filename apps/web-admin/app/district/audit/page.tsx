/**
 * District audit trail (Sprint B4) — reads the tenant-scoped, hash-chained
 * district_activity_log via identity-svc. This replaces the previous
 * listAdminAuditLogs call, which required a platform-only permission and
 * could never return data for a district admin.
 */
import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminPageFrame, DataTable } from "@aivo/admin-ui";
import { listDistrictActivity } from "@/lib/district-activity";
import { formatDateTime } from "@/components/admin-format";

const PAGE_SIZE = 30;

export default async function DistrictAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() || undefined;
  const data = await listDistrictActivity(session, { page, pageSize: PAGE_SIZE, q });

  return (
    <AdminPageFrame
      eyebrow="District"
      title="Audit log"
      description="Every administrative action and sensitive-data view recorded for your district, hash-chained for tamper evidence."
      action={
        <Link className="admin-button" href="/district/audit/export">
          Export &amp; verify
        </Link>
      }
    >
      <div className="mt-8">
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
          rows={data.rows}
          rowKey={(row) => row.id}
          total={data.total}
          page={data.page}
          pageSize={data.pageSize}
          basePath="/district/audit"
          search={q}
          emptyMessage="No activity matches these filters."
          searchPlaceholder="Search action, actor, resource…"
        />
      </div>
    </AdminPageFrame>
  );
}
