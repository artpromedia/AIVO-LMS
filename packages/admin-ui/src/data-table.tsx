/**
 * Server-driven DataTable (Sprint B3).
 *
 * Built for the web-admin architecture: pages stay thin SERVER components
 * — all state (page/search/sort) lives in URL searchParams, so this
 * component renders plain links and a GET form, no client JS required.
 *
 *   - debint search box (GET form preserves other params via hidden inputs)
 *   - numbered pager with prev/next, driven by `total`
 *   - optional sort toggle per column (aria-sort on the active header)
 *   - optional CSV export link (same filters; the endpoint audits)
 *   - empty + truncation states
 */
import * as React from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Server sort value this column toggles (e.g. "createdAt"). */
  sortKey?: string;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  total: number;
  page: number;
  pageSize: number;
  /** Path the pager/search/sort links target (e.g. "/platform/audit"). */
  basePath: string;
  /** Current search text (rendered into the box + preserved in links). */
  search?: string;
  /** Current sort value (e.g. "createdAt:desc"). */
  sort?: string;
  /** Href for the audited CSV export of the SAME filters. */
  exportHref?: string;
  /**
   * Extra filter params (e.g. date range) preserved across search, sort,
   * and pager navigation — rendered as hidden inputs + merged into hrefs.
   */
  extraParams?: Record<string, string | undefined>;
  emptyMessage: string;
  searchPlaceholder?: string;
  /** Render the free-text search form (default true). */
  searchable?: boolean;
}

function buildHref(
  basePath: string,
  params: Record<string, string | number | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) qs.set(key, String(value));
  }
  const text = qs.toString();
  return text ? `${basePath}?${text}` : basePath;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  total,
  page,
  pageSize,
  basePath,
  search,
  sort,
  exportHref,
  extraParams,
  emptyMessage,
  searchPlaceholder = "Search…",
  searchable = true,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const windowStart = Math.max(1, current - 2);
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages - windowStart + 1) },
    (_, i) => windowStart + i,
  );
  const extras: Record<string, string | undefined> = extraParams ?? {};

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {searchable ? (
          <form action={basePath} method="get" className="flex items-center gap-2" role="search">
            {sort ? <input type="hidden" name="sort" value={sort} /> : null}
            {Object.entries(extras).map(([name, value]) =>
              value ? <input key={name} type="hidden" name={name} value={value} /> : null,
            )}
            <input
              className="admin-input !mt-0 w-64"
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
            <button className="admin-button-secondary" type="submit">
              Search
            </button>
            {search ? (
              <a
                className="text-sm font-semibold text-blue-700 hover:underline"
                href={buildHref(basePath, { ...extras, sort })}
              >
                Clear
              </a>
            ) : null}
          </form>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600" data-testid="table-total">
            {total.toLocaleString()} row{total === 1 ? "" : "s"}
          </span>
          {exportHref ? (
            <a className="admin-button-secondary" href={exportHref} data-testid="table-export">
              Export CSV
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => {
                if (!column.sortKey) return <th key={column.key}>{column.header}</th>;
                const active = sort?.startsWith(`${column.sortKey}:`);
                const direction = active && sort?.endsWith(":asc") ? "asc" : "desc";
                const nextSort = `${column.sortKey}:${active && direction === "desc" ? "asc" : "desc"}`;
                return (
                  <th key={column.key} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <a
                      className="inline-flex items-center gap-1 hover:underline"
                      href={buildHref(basePath, { ...extras, q: search, sort: nextSort })}
                    >
                      {column.header}
                      {active ? <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span> : null}
                    </a>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="mt-4 flex items-center gap-2" aria-label="Pagination" data-testid="table-pager">
        <PagerLink
          href={buildHref(basePath, { ...extras, q: search, sort, page: current - 1 })}
          disabled={current <= 1}
          label="Previous"
        />
        {pageNumbers.map((n) => (
          <PagerLink
            key={n}
            href={buildHref(basePath, { ...extras, q: search, sort, page: n })}
            disabled={false}
            current={n === current}
            label={String(n)}
          />
        ))}
        {totalPages > (pageNumbers.at(-1) ?? 1) ? (
          <span className="text-sm text-slate-500">… of {totalPages.toLocaleString()}</span>
        ) : null}
        <PagerLink
          href={buildHref(basePath, { ...extras, q: search, sort, page: current + 1 })}
          disabled={current >= totalPages}
          label="Next"
        />
      </nav>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  label,
  current = false,
}: {
  href: string;
  disabled: boolean;
  label: string;
  current?: boolean;
}) {
  if (disabled) {
    return (
      <span className="rounded px-2 py-1 text-sm text-slate-400" aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <a
      className={
        current
          ? "rounded bg-blue-700 px-2 py-1 text-sm font-semibold text-white"
          : "rounded px-2 py-1 text-sm font-semibold text-blue-700 hover:underline"
      }
      aria-current={current ? "page" : undefined}
      href={href}
    >
      {label}
    </a>
  );
}
