/** Route-level boundary so school navigations commit instantly (see
 *  app/platform/loading.tsx for why the shell needs this). */
export default function SchoolLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 py-2">
      <div className="admin-skeleton h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="admin-card space-y-3 p-5">
            <div className="admin-skeleton h-3 w-1/2" />
            <div className="admin-skeleton h-7 w-2/3" />
          </div>
        ))}
      </div>
      <div className="admin-card space-y-3 p-6">
        <div className="admin-skeleton h-4 w-1/4" />
        <div className="admin-skeleton h-40 w-full" />
      </div>
    </div>
  );
}
