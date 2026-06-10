/**
 * Route-level loading boundary for /platform/*. Pages here are fully
 * dynamic (several admin-svc reads each); without this boundary a client
 * navigation holds its RSC stream open until the slowest read resolves,
 * which both feels dead and can get the transition aborted. With it, the
 * navigation commits immediately and streams the page in.
 */
export default function PlatformLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 py-2">
      <div className="admin-skeleton h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="admin-card space-y-3 p-5">
            <div className="admin-skeleton h-3 w-1/2" />
            <div className="admin-skeleton h-7 w-2/3" />
            <div className="admin-skeleton h-3 w-1/3" />
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
