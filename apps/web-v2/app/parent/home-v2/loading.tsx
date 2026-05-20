/**
 * /parent/home-v2 — loading skeleton.
 *
 * Keeps the same canvas + page max-width as the page so layout
 * doesn't jump on hydration. Skeleton blocks loosely mirror the
 * hero + 6-card metric grid + section grid.
 */
export default function ParentHomeV2Loading() {
  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)]">
      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex flex-col gap-6"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading your parent home…</span>

        {/* Hero skeleton */}
        <div className="rounded-iw-card-lg bg-white border border-iw-border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)] p-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="h-8 w-3/4 rounded-iw-control bg-iw-card animate-pulse" />
            <div className="h-6 w-2/3 rounded-iw-control bg-iw-card animate-pulse" />
            <div className="h-4 w-5/6 rounded-iw-control bg-iw-card animate-pulse mt-2" />
            <div className="flex gap-2 mt-3">
              <div className="h-11 w-40 rounded-iw-control bg-iw-card animate-pulse" />
              <div className="h-11 w-40 rounded-iw-control bg-iw-card animate-pulse" />
            </div>
          </div>
          <div className="h-64 rounded-iw-card-lg bg-iw-card animate-pulse" />
        </div>

        {/* Setup progress skeleton */}
        <div className="rounded-iw-card-lg bg-white border border-iw-border p-5 grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-iw-control bg-iw-card animate-pulse" />
          ))}
        </div>

        {/* Metric grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-iw-card-lg bg-white border border-iw-border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)] animate-pulse"
            />
          ))}
        </div>

        {/* Section grid skeleton */}
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-iw-card-lg bg-white border border-iw-border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)] animate-pulse"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
