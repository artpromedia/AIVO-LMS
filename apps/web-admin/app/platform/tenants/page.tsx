import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminTenantsPage } from "@aivo/admin-api/platform";
import { AdminPageFrame, DataTable } from "@aivo/admin-ui";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/components/admin-format";

const PAGE_SIZE = 50;

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  const session = await requirePlatformPage("tenant:read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim() || undefined;
  const sort = params.sort;
  const result = await listAdminTenantsPage(session, {
    page,
    pageSize: PAGE_SIZE,
    search,
    sort,
  });

  return (
    <AdminPageFrame
      title="Tenants"
      description={`${result.total.toLocaleString()} districts, schools, and family workspaces.`}
    >
      <div className="mt-8">
        <DataTable
          basePath="/platform/tenants"
          rows={result.rows}
          rowKey={(row) => row.id}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          search={search}
          sort={sort}
          exportHref={`/platform/tenants/export${search ? `?q=${encodeURIComponent(search)}` : ""}`}
          emptyMessage="No tenants match."
          searchPlaceholder="Search tenant name…"
          columns={[
            {
              key: "name",
              header: "Tenant",
              sortKey: "name",
              render: (row) => (
                <a
                  className="font-semibold text-violet-700 hover:underline"
                  href={`/platform/tenants/${row.id}`}
                >
                  {row.name}
                </a>
              ),
            },
            { key: "type", header: "Type", render: (row) => row.typeLabel },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusPill status={row.status ?? "active"} />,
            },
            {
              key: "created",
              header: "Created",
              sortKey: "createdAt",
              render: (row) => formatDateTime(row.createdAt),
            },
          ]}
        />
      </div>
    </AdminPageFrame>
  );
}
