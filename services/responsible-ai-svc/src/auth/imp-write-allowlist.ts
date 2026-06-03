/**
 * Impersonation write allowlist for responsible-ai-svc (Sprint 9).
 *
 * Under an impersonation token, writes are denied by default. Only the
 * (method, pathPrefix) pairs listed here are permitted, and only when the
 * impersonation token also carries `imp_writes_ok === true`. Keep this list
 * minimal: an admin "viewing as" a user should almost never mutate state on
 * the user's behalf. Filing an incident on behalf of a user under review is
 * the one justified case here.
 */
import { createImpWriteAllowlist, type ImpWriteAllowlist } from "@aivo/enterprise-core";

export const impWriteAllowlist: ImpWriteAllowlist = createImpWriteAllowlist([
  // Allow filing an RAI incident while viewing-as (writes-enabled sessions only).
  { method: "POST", pathPrefix: "/api/responsible-ai/incidents" },
]);
