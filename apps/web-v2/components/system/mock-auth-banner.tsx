/**
 * Sprint 24: prominent banner that the v2 app still uses mock auth.
 * Production auth (Clerk / Auth.js / custom) is intentionally deferred.
 * Hide by setting NEXT_PUBLIC_AUTH_MODE=production once a real provider is wired.
 */
export function MockAuthBanner() {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === "production") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-50 text-amber-900 border-b border-amber-200 text-xs px-4 py-1.5 text-center"
    >
      Demo mode — mock authentication is active. Switch the role from the
      session menu. Production identity provider is not yet enabled.
    </div>
  );
}
