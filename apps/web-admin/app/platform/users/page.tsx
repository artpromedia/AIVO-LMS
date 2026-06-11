import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminUsersPage } from "@aivo/admin-api/platform";
import { AdminPageFrame, DataTable } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const PAGE_SIZE = 50;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim() || undefined;
  const result = await listAdminUsersPage(session, { page, pageSize: PAGE_SIZE, search });

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Users"
      description={`${result.total.toLocaleString()} administrator, educator, and guardian accounts.`}
    >
      <div className="mt-8">
        <DataTable
          basePath="/platform/users"
          rows={result.rows}
          rowKey={(row) => row.id}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          search={search}
          exportHref={`/platform/users/export${search ? `?q=${encodeURIComponent(search)}` : ""}`}
          emptyMessage="No users match."
          searchPlaceholder="Search name or email…"
          columns={[
            {
              key: "user",
              header: "User",
              render: (row) => (
                <Link className="font-semibold text-blue-700 hover:underline" href={`/platform/users/${row.id}`}>
                  {row.name || row.email}
                  <span className="block text-xs font-normal text-slate-500">{row.email}</span>
                </Link>
              ),
            },
            { key: "role", header: "Role", render: (row) => row.role },
            { key: "tenant", header: "Tenant", render: (row) => row.tenantId ?? "—" },
            { key: "lastLogin", header: "Last login", render: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "—") },
            { key: "created", header: "Created", render: (row) => formatDateTime(row.createdAt) },
          ]}
        />
      </div>
    </AdminPageFrame>
  );
}
