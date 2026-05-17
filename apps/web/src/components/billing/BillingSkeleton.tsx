"use client";

/**
 * Loading skeleton for the parent billing screen. Mirrors the gross
 * layout (three-up summary, plan cards, add-ons strip, invoice list)
 * so the page doesn't visibly snap when the real data arrives.
 *
 * Static markup, no animation library — pure CSS keyframes inherited
 * from the global stylesheet's `animate-pulse` utility.
 */
export function BillingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="vi-card p-6 h-32">
            <div className="h-3 w-20 vi-surface-soft rounded mb-3" />
            <div className="h-6 w-32 vi-surface-soft rounded mb-2" />
            <div className="h-3 w-24 vi-surface-soft rounded" />
          </div>
        ))}
      </div>
      <div className="vi-card p-6">
        <div className="h-5 w-40 vi-surface-soft rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl p-6 border-2 vi-border h-60" />
          ))}
        </div>
      </div>
      <div className="vi-card p-6">
        <div className="h-5 w-32 vi-surface-soft rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl vi-surface-soft" />
          ))}
        </div>
      </div>
    </div>
  );
}
