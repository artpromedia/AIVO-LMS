"use client";

export default function LearnerCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      role="status"
      aria-live="polite"
      aria-label="Loading learners"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse motion-reduce:animate-none" />
            <div className="h-5 w-16 bg-purple-100 rounded-full animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-3 w-20 bg-slate-100 rounded animate-pulse motion-reduce:animate-none mb-3" />
          <div className="h-3 w-full bg-slate-100 rounded animate-pulse motion-reduce:animate-none" />
        </div>
      ))}
      <span className="sr-only">Loading learner cards...</span>
    </div>
  );
}
