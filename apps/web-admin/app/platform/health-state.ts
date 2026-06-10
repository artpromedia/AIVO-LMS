/**
 * Pure helper for the platform home's degraded system-health state. Kept free
 * of "@aivo/admin-api" imports (which pull in "server-only") so it stays
 * unit-testable; AdminApiError is matched structurally instead.
 */
type AdminApiErrorLike = Error & { status: number };

function isAdminApiError(error: unknown): error is AdminApiErrorLike {
  return (
    error instanceof Error &&
    error.name === "AdminApiError" &&
    typeof (error as Partial<AdminApiErrorLike>).status === "number"
  );
}

export function describeSystemHealthFailure(error: unknown): string {
  if (isAdminApiError(error)) {
    if (error.status === 401 || error.status === 403) {
      return `admin-svc rejected the console's credentials (${error.status}: ${error.message}). Check that admin-svc verifies tokens with the identity-svc JWT public key.`;
    }
    return `admin-svc responded with an error (${error.status}: ${error.message}).`;
  }
  return "admin-svc could not be reached from the console.";
}
