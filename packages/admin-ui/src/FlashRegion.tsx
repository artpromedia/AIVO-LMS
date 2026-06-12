/**
 * FlashRegion — accessible action feedback for the admin console.
 *
 * Renders a notice as a polite status and an error as an assertive alert.
 * Works for both feedback styles in the codebase:
 *   - redirect pages pass `?notice=` / `?error=` search params through;
 *   - useActionState consumers pass the action's returned state.
 * Server-component-safe (no hooks).
 */
export function FlashRegion({
  notice,
  error,
  className,
}: {
  notice?: string | null;
  error?: string | null;
  className?: string;
}) {
  if (!notice && !error) return null;
  return (
    <div className={className}>
      {notice ? (
        <p role="status" aria-live="polite" className="admin-notice">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="admin-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
