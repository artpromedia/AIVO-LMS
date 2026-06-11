import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminAuditLogsPage } from "@aivo/admin-api/audit";
import { AdminPageFrame, DataTable } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const PAGE_SIZE = 50;

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim() || undefined;
  const sort = params.sort === "createdAt:asc" ? ("createdAt:asc" as const) : ("createdAt:desc" as const);
  const result = await listAdminAuditLogsPage(session, { page, pageSize: PAGE_SIZE, search, sort });

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Audit log"
      description="Immutable, hash-chained record of privileged administrative actions across the platform."
    >
      <div className="mt-8">
        <DataTable
          basePath="/platform/audit"
          rows={result.rows}
          rowKey={(row) => row.id}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          search={search}
          sort={sort}
          exportHref={`/platform/audit/export${search ? `?q=${encodeURIComponent(search)}` : ""}`}
          emptyMessage="No audit entries match."
          searchPlaceholder="Search action, actor email, or details…"
          columns={[
            { key: "when", header: "When", sortKey: "createdAt", render: (row) => formatDateTime(row.createdAt) },
            { key: "action", header: "Action", render: (row) => <span className="font-mono text-xs">{row.action}</span> },
            {
              key: "actor",
              header: "Actor",
              render: (row) => (
                <span>
                  {row.actorEmail}
                  <span className="block text-xs text-slate-500">{row.actorRoleLabel}</span>
                </span>
              ),
            },
            {
              key: "resource",
              header: "Resource",
              render: (row) => (
                <span className="font-mono text-xs">
                  {row.resourceType}
                  {row.resourceId ? `/${row.resourceId}` : ""}
                </span>
              ),
            },
            { key: "tenant", header: "Tenant", render: (row) => row.tenantId ?? "—" },
          ]}
        />
      </div>
    </AdminPageFrame>
  );
}
