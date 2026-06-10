/**
 * Pure helper for the platform home's degraded system-health state. Kept free
 * of "@aivo/admin-api" imports (which pull in "server-only") so it stays
 * unit-testable; AdminApiError is matched structurally instead.
 */
type AdminApiErrorLike = Error & { status: number; payload?: unknown };

function isAdminApiError(error: unknown): error is AdminApiErrorLike {
  return (
    error instanceof Error &&
    error.name === "AdminApiError" &&
    typeof (error as Partial<AdminApiErrorLike>).status === "number"
  );
}

/**
 * Digs the actionable cause out of an admin-svc error body. Fastify's default
 * 500 body buries it in `message` (`error` is just "Internal Server Error");
 * admin-svc's own 503s put it in `detail`. Collapsed/truncated because
 * "Failed query: …" messages embed multi-line SQL.
 */
function payloadDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const detail = record.detail ?? record.message;
  if (typeof detail !== "string" || !detail) return null;
  return detail.replace(/\s+/g, " ").slice(0, 300);
}

export function describeSystemHealthFailure(error: unknown): string {
  if (isAdminApiError(error)) {
    if (error.status === 401 || error.status === 403) {
      return `admin-svc rejected the console's credentials (${error.status}: ${error.message}). Check that admin-svc verifies tokens with the identity-svc JWT public key.`;
    }
    const detail = payloadDetail(error.payload);
    const suffix = detail && detail !== error.message ? ` — ${detail}` : "";
    return `admin-svc responded with an error (${error.status}: ${error.message}${suffix}).`;
  }
  return "admin-svc could not be reached from the console.";
}
