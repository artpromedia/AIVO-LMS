/**
 * Deep-link resolver — ADR 0020 Phase 3.
 *
 * Both shells receive entry URLs from a variety of off-app sources:
 *
 *   - the mobile custom scheme (`aivo://learner/123/goals`)
 *   - universal / Android-app links (`https://aivo.app/learner/123/goals`)
 *   - in-app links and shared deep links
 *   - notifications (the Phase 3 push contract carries a `targetRole`
 *     and an `href`)
 *
 * Historically the per-role shells would 404 (or redirect to the
 * shell's "wrong role" page) when the active role couldn't reach the
 * area the URL targeted. The Phase 3 contract is that a deep link
 * **never 404s** as long as *some* role the session holds can reach
 * the requested area; the resolver returns enough information for the
 * web `<RoleGate>` or the mobile guard to either render the target,
 * 307 to `/role-switch?to=<role>&next=<path>`, prompt step-up, render
 * a `<LockedScreen>`, or fall through to `forbidden`.
 *
 * The resolver is intentionally **pure**: it accepts a parsed `URL`
 * (or string), a `RoleSession`, and an optional `Surface`, and
 * returns a structured decision. It does not import React, Next,
 * Expo Router, or fetch. The two shells own the side effects (the
 * actual redirect / navigation / step-up sheet); this module owns
 * the policy and the precedence order.
 */
import type { NavArea } from "./areas.js";
import { NAV_AREAS } from "./areas.js";
import { getPermission } from "./permissions.js";
import type { Role } from "./roles.js";
import { ROLE_META } from "./roles.js";
import type { Surface } from "./routes.js";
import {
  allRolesForSurface,
  canAccessArea,
  getRolesForSurface,
  type RoleSession,
} from "./session.js";

/* ─────────────────────────── Path → NavArea map ─────────────────────────── */

/**
 * Maps a route prefix to the `NavArea` whose permission row governs
 * access. Prefixes match the actual route segments shipped by both
 * shells (`/learner/:id/goals`, `/parent/learners`, `/notifications`,
 * …). The order matters — the most specific entry wins, so the table
 * is searched in declaration order.
 *
 * The role-segment prefixes (`/learner/...`, `/parent/...`) intentionally
 * resolve to the same `NavArea` as the matching learner-scoped
 * sub-path so that a deep link from a notification or share sheet
 * lands on the right slice regardless of which shell originated the URL.
 */
interface RouteRule {
  /** Regex applied to the **pathname** of the parsed URL. */
  pattern: RegExp;
  /** The `NavArea` that owns the permission row for this path. */
  area: NavArea;
  /**
   * Optional named capture extractor. Currently we only extract
   * `learnerId`, but the shape is open so future routes (assignment
   * id, message thread id, …) can ride on the same machinery.
   */
  extract?: (m: RegExpMatchArray) => DeepLinkParams;
}

/** Extracted, structured parameters parsed out of the path. */
export interface DeepLinkParams {
  /** Numeric or UUID learner id when the path was learner-scoped. */
  learnerId?: string;
  /** Optional learner sub-resource (e.g. "goals", "iep", "progress"). */
  subResource?: string;
}

const LEARNER_SUBPATHS: Record<string, NavArea> = {
  goals: "iep",
  iep: "iep",
  progress: "progress",
  baseline: "baseline",
  lessons: "lessons",
  homework: "homeworkHelper",
  tutor: "aiTutor",
  messages: "messages",
  approvals: "approvals",
  reports: "reports",
  safety: "safety",
  subjects: "subjects",
};

const ROUTE_RULES: readonly RouteRule[] = [
  // aivo://learner/123/<sub> and /learner/:id/<sub>
  {
    pattern: /^\/learner\/([^/]+)\/([^/]+)(?:\/|$)/,
    area: "learners",
    extract: (m) => ({
      learnerId: m[1],
      subResource: m[2],
    }),
  },
  // /learner/:id (profile root)
  {
    pattern: /^\/learner\/([^/]+)(?:\/|$)/,
    area: "learners",
    extract: (m) => ({ learnerId: m[1] }),
  },
  // Cross-cutting top-level surfaces.
  { pattern: /^\/notifications(?:\/|$)/, area: "messages" },
  { pattern: /^\/messages(?:\/|$)/, area: "messages" },
  { pattern: /^\/settings(?:\/|$)/, area: "settings" },
  { pattern: /^\/billing(?:\/|$)/, area: "billing" },
  // Role-segmented landing routes — each maps to the area whose row
  // governs the segment's home destination.
  { pattern: /^\/parent\/(?:learners|reports)/, area: "learners" },
  { pattern: /^\/parent\/consent/, area: "approvals" },
  { pattern: /^\/parent\/schedule/, area: "lessons" },
  { pattern: /^\/parent\/notifications/, area: "messages" },
  { pattern: /^\/parent(?:\/|$)/, area: "home" },
  { pattern: /^\/teacher\/(?:learners|insights)/, area: "learners" },
  { pattern: /^\/teacher\/lesson-plans/, area: "lessons" },
  { pattern: /^\/teacher\/assignments/, area: "approvals" },
  { pattern: /^\/teacher\/reports/, area: "reports" },
  { pattern: /^\/teacher(?:\/|$)/, area: "home" },
  { pattern: /^\/therapist\/sessions/, area: "learners" },
  { pattern: /^\/therapist\/reports/, area: "reports" },
  { pattern: /^\/therapist(?:\/|$)/, area: "home" },
  { pattern: /^\/caregiver\/learners/, area: "learners" },
  { pattern: /^\/caregiver\/messages/, area: "messages" },
  { pattern: /^\/caregiver(?:\/|$)/, area: "home" },
  { pattern: /^\/admin\/school\/learners/, area: "learners" },
  { pattern: /^\/admin\/school\/(?:billing)/, area: "billing" },
  { pattern: /^\/admin\/school\/(?:reports|compliance)/, area: "reports" },
  { pattern: /^\/admin\/school(?:\/|$)/, area: "admin" },
  { pattern: /^\/admin\/district\/(?:reports|compliance)/, area: "reports" },
  { pattern: /^\/admin\/district\/(?:billing)/, area: "billing" },
  { pattern: /^\/admin\/district(?:\/|$)/, area: "admin" },
  { pattern: /^\/admin\/platform(?:\/|$)/, area: "admin" },
  { pattern: /^\/(?:learner)\/(?:lesson-runs|lessons)/, area: "lessons" },
  { pattern: /^\/(?:learner)\/homework/, area: "homeworkHelper" },
  { pattern: /^\/(?:learner)\/(?:quests|tutor)/, area: "aiTutor" },
  { pattern: /^\/(?:learner)\/progress/, area: "progress" },
  { pattern: /^\/(?:learner)\/subjects/, area: "subjects" },
  { pattern: /^\/(?:learner)(?:\/|$)/, area: "home" },
];

/* ──────────────────────────── Public types ──────────────────────────── */

/** Sentinel for the path-resolution stage. */
export type ResolutionOutcome =
  /** The active role can render this target directly. */
  | "allow"
  /** The session holds another role that can; caller should route to /role-switch. */
  | "switch-role"
  /** The path is reachable for the active role but locked. */
  | "locked"
  /** No role the session holds can reach this area on this surface. */
  | "forbidden"
  /** The URL didn't match any known route shape — caller should 404. */
  | "unmatched";

export interface DeepLinkDecision {
  outcome: ResolutionOutcome;
  /** Normalised pathname (no query, no hash) the caller should route to. */
  pathname: string;
  /** Original search component preserved for redirect chaining. */
  search: string;
  /** Original hash component preserved for redirect chaining. */
  hash: string;
  /** The `NavArea` the URL was classified into. */
  area?: NavArea;
  /** Set on `switch-role`; the role the caller should switch into. */
  requiredRole?: Role;
  /** `true` when switching into `requiredRole` requires step-up auth. */
  requiresStepUp: boolean;
  /** Set on `locked`; copy from the permission row. */
  lockReason?: string;
  /** Structured params extracted from the path (learnerId, sub-resource). */
  params: DeepLinkParams;
}

/* ───────────────────────────── Resolver ─────────────────────────── */

/**
 * Normalise an incoming deep-link URL into a parsed `URL` object.
 *
 * Accepts:
 *   - `aivo://learner/123/goals` (custom scheme; host becomes the
 *     first path segment).
 *   - `https://aivo.app/learner/123/goals` (universal link).
 *   - `/learner/123/goals` (bare pathname; already on the shell).
 *
 * Returns `null` for inputs that can't be parsed at all.
 */
export function parseDeepLinkUrl(input: string): URL | null {
  if (!input) return null;
  const trimmed = input.trim();
  // `aivo://learner/123/goals` — the `learner` segment is the URL's
  // host with `WHATWG URL`. Re-shape so the host becomes part of the path.
  const customScheme = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(trimmed);
  if (customScheme && customScheme[1].toLowerCase() === "aivo") {
    try {
      const rest = customScheme[2];
      // Synthesize an https URL so URL parsing picks up search & hash.
      return new URL(`https://aivo.invalid/${rest}`);
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("/")) {
    try {
      return new URL(`https://aivo.invalid${trimmed}`);
    } catch {
      return null;
    }
  }
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/**
 * Resolve a deep-link URL against a role session. The result tells
 * the caller whether to render the target, switch role, prompt
 * step-up, lock, forbid, or 404.
 *
 * Precedence order — mirrors `canAccessArea`:
 *   1. The active role gets `allow` / `locked`, in that order, if
 *      its permission row says so.
 *   2. Otherwise, the resolver scans `session.roles` (in declaration
 *      order — the same order the role switcher presents) for the
 *      first surface-visible role that can reach the area, and
 *      returns `switch-role` with that role as `requiredRole`.
 *   3. Otherwise `forbidden`.
 *
 * When the URL doesn't match any known route shape, the resolver
 * returns `unmatched` so the shell can fall back to its 404 page.
 * Learner-scoped sub-paths (`/learner/:id/goals`) always remap onto
 * the area governing the sub-resource (`iep` for `goals`, etc.) so a
 * notification deep-link from the IEP service still lights up the
 * correct row.
 */
export function resolveDeepLink(
  input: string | URL,
  session: RoleSession,
  surface: Surface = "web",
): DeepLinkDecision {
  const url = typeof input === "string" ? parseDeepLinkUrl(input) : input;
  if (!url) {
    return {
      outcome: "unmatched",
      pathname: "",
      search: "",
      hash: "",
      requiresStepUp: false,
      params: {},
    };
  }

  const pathname = url.pathname || "/";
  const search = url.search ?? "";
  const hash = url.hash ?? "";

  let area: NavArea | undefined;
  let params: DeepLinkParams = {};

  for (const rule of ROUTE_RULES) {
    const m = pathname.match(rule.pattern);
    if (!m) continue;
    area = rule.area;
    if (rule.extract) {
      params = rule.extract(m);
    }
    // Learner-scoped sub-paths refine the area: `/learner/123/goals`
    // is governed by the `iep` row, not `learners`.
    if (params.subResource && LEARNER_SUBPATHS[params.subResource]) {
      area = LEARNER_SUBPATHS[params.subResource];
    }
    break;
  }

  if (!area) {
    return {
      outcome: "unmatched",
      pathname,
      search,
      hash,
      requiresStepUp: false,
      params,
    };
  }

  const decision = canAccessArea(session, area, surface);

  if (decision.outcome === "allow") {
    return {
      outcome: "allow",
      pathname,
      search,
      hash,
      area,
      requiresStepUp: false,
      params,
    };
  }
  if (decision.outcome === "locked") {
    return {
      outcome: "locked",
      pathname,
      search,
      hash,
      area,
      lockReason: decision.lockReason,
      requiresStepUp: false,
      params,
    };
  }
  if (decision.outcome === "switch-role" && decision.requiredRole) {
    const required = decision.requiredRole;
    return {
      outcome: "switch-role",
      pathname,
      search,
      hash,
      area,
      requiredRole: required,
      requiresStepUp: ROLE_META[required].requiresStepUp,
      params,
    };
  }
  return {
    outcome: "forbidden",
    pathname,
    search,
    hash,
    area,
    requiresStepUp: false,
    params,
  };
}

/**
 * Build the `/role-switch` URL the shells redirect to when
 * `resolveDeepLink` returns `switch-role`. Kept here so both shells
 * agree on the query-string contract (`to`, `next`, `reason`).
 */
export function buildRoleSwitchHref(
  required: Role,
  decision: Pick<DeepLinkDecision, "pathname" | "search" | "hash">,
  reason: "deep-link" | "notification" = "deep-link",
): string {
  const next = `${decision.pathname}${decision.search}${decision.hash}`;
  const qs = new URLSearchParams({
    to: required,
    next,
    reason,
  });
  return `/role-switch?${qs.toString()}`;
}

/* ───────────────────── Internal helpers (test surface) ────────────────── */

/**
 * The set of `NavArea`s every deep-link rule references. Exposed for
 * the matrix-coverage test (`packages/nav/src/__tests__/matrix-coverage.test.ts`)
 * so the gate can assert every (role × deep-link area) pair has a
 * permission row.
 */
export function getDeepLinkAreas(): readonly NavArea[] {
  const seen = new Set<NavArea>();
  for (const rule of ROUTE_RULES) seen.add(rule.area);
  for (const area of Object.values(LEARNER_SUBPATHS)) seen.add(area);
  // Sort by NAV_AREAS order for deterministic output.
  return NAV_AREAS.filter((a) => seen.has(a));
}

/**
 * The same surface filter `RoleSwitcher` applies, exposed for tests
 * that want to spot-check that a resolver result is achievable on the
 * current shell.
 */
export function getSwitchableRoles(
  session: RoleSession,
  surface: Surface,
): Role[] {
  // Re-use the canonical filter so this helper stays in lockstep with
  // the rest of the package.
  const surfaceRoles = getRolesForSurface(session.roles, surface);
  // Defence in depth — never return a role the surface doesn't expose
  // even if `session.roles` somehow gets out of sync.
  const allowed = new Set<Role>(allRolesForSurface(surface));
  return surfaceRoles.filter((r) => allowed.has(r));
}

/**
 * Look up the `NavArea` a pure pathname resolves to, **without**
 * consulting the role session. Useful for cache keys, analytics
 * stamping, and tests.
 */
export function classifyDeepLinkPath(pathname: string): {
  area: NavArea | null;
  params: DeepLinkParams;
} {
  for (const rule of ROUTE_RULES) {
    const m = pathname.match(rule.pattern);
    if (!m) continue;
    const params: DeepLinkParams = rule.extract ? rule.extract(m) : {};
    let area: NavArea = rule.area;
    if (params.subResource && LEARNER_SUBPATHS[params.subResource]) {
      area = LEARNER_SUBPATHS[params.subResource];
    }
    return { area, params };
  }
  return { area: null, params: {} };
}
