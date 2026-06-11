/**
 * Same-origin redirect-target validation (Sprint A3, ZAP #65 "User
 * Controllable HTML Element Attribute" on /login?next=).
 *
 * Any `next` value that round-trips through the login/logout flows must
 * be a same-origin absolute PATH: leading single "/", no protocol, no
 * "//host" protocol-relative form, no backslash trickery, no embedded
 * scheme. Anything else collapses to the fallback. Shared by the login
 * server action and the logout route handler so the policy can't drift.
 */
export function safeNextPath(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 1024) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;
  // A colon before any "?"/"#" could smuggle a scheme through some parsers.
  const pathOnly = raw.split(/[?#]/, 1)[0];
  if (pathOnly.includes(":")) return fallback;
  return raw;
}
