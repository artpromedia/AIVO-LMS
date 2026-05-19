/**
 * Sprint 24: prominent banner that the v2 app still uses mock auth.
 * Production auth (Clerk / Auth.js / custom) is intentionally deferred.
 * Hide by setting NEXT_PUBLIC_AUTH_MODE=production once a real provider is wired.
 */
export function MockAuthBanner() {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === "production") return null;
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-2 sm:px-6">
      <div
        role="status"
        aria-live="polite"
        className="rounded-iw-pill border border-iw-warm bg-iw-warm-soft px-4 py-2 text-center text-xs font-medium text-iw-ink shadow-soft-1"
      >
        Demo mode — mock authentication is active. Switch the role from the session menu.
        Production identity provider is not yet enabled.
      </div>
    </div>
  );
}
