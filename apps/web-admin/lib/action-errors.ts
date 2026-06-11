/**
 * Central server-action error mapper (Sprint A2).
 *
 * Before this module, every admin page redirected with the RAW backend
 * message in the URL (`?error=DSAR request ID not found`), leaking
 * service internals into browser history, referrers, and access logs.
 *
 * `actionError(error, fallback)` returns a SAFE, status-class user message
 * and reports the full error server-side (structured log + Sentry). The
 * page-authored `fallback` is the generic per-domain text each page
 * already shipped ("Policy update failed.") — used when the error is not
 * an AdminApiError or carries a non-categorizable status.
 */
import * as Sentry from "@sentry/nextjs";
import { AdminApiError } from "@aivo/admin-api";

export function actionError(error: unknown, fallback: string): string {
  // Full detail stays server-side only.
  console.error("[web-admin action]", error);
  Sentry.captureException(error);

  if (error instanceof AdminApiError) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return "You do not have permission to perform this action.";
    }
    if (status === 404) {
      return "The requested record was not found. It may have been removed.";
    }
    if (status === 409) {
      return "This change conflicts with the current state. Refresh and try again.";
    }
    if (status === 422 || status === 400) {
      return "The submitted values were not accepted. Check the form and try again.";
    }
    if (typeof status === "number" && status >= 500) {
      return "The backing service failed. The team has been notified.";
    }
  }
  return fallback;
}
