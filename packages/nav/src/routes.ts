import type { NavArea } from "./areas.js";
import type { Role } from "./roles.js";
import { getPermission } from "./permissions.js";

export type Surface = "web" | "mobile";

/**
 * Resolve the route for a role + area on a specific surface. Returns
 * `null` if the role has no navigable destination (locked or hidden).
 *
 * For `locked` areas the caller should route to `/locked/[area]` on
 * the web shell or push a `LockedScreen` modal on mobile.
 */
export function resolveRoute(
  role: Role,
  area: NavArea,
  surface: Surface,
): string | null {
  const p = getPermission(role, area);
  if (p.access === "hidden") return null;
  if (p.access === "locked") {
    return surface === "web" ? `/locked/${area}` : `/locked/${area}`;
  }
  return surface === "web" ? p.webRoute ?? null : p.mobileRoute ?? null;
}

/**
 * Convenience: route a role to its primary landing page on a surface.
 */
export function homeRoute(role: Role, surface: Surface): string {
  return resolveRoute(role, "home", surface) ?? "/";
}
