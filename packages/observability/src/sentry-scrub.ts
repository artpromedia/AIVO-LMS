/**
 * Sentry event scrubber — the COPPA boundary for client-side telemetry.
 *
 * Every Sentry init in this repo (web-v2, web-admin, mobile) MUST route
 * events through `scrubSentryEvent` via `beforeSend` /
 * `beforeSendTransaction`. The platform serves children: no learner
 * identifier, email, name, IEP/medical text, or free-form user content may
 * leave the process inside an error event. Treat changes here as security
 * code — they are unit-tested in sentry-scrub.test.ts and enforced by
 * scripts/observability-audit.mjs.
 *
 * The scrubber is dependency-free and structural (it types the minimal
 * shape it touches) so the same implementation runs in Node, browser, and
 * React Native bundles without pulling any @sentry/* package in here.
 */

/**
 * Key families whose VALUES are always redacted wherever they appear.
 * Substring match on the lowercased key so camelCase / snake_case /
 * kebab-case all hit ("learnerId", "learner_ids", "x-learner-id").
 * Bias is deliberately toward over-scrubbing: an extra redacted field is
 * noise; a missed one is a COPPA incident.
 */
const SENSITIVE_KEY_FAMILIES = [
  "learner",
  "email",
  "displayname",
  "display_name",
  "username",
  "firstname",
  "first_name",
  "lastname",
  "last_name",
  "fullname",
  "full_name",
  "iep",
  "medical",
  "diagnos",
  "password",
  "passwd",
  "token",
  "secret",
  "cookie",
  "authorization",
  "session",
  "birth",
  "address",
  "phone",
] as const;

/** Short keys that must match exactly (substring would over-fire wildly). */
const SENSITIVE_EXACT_KEYS = new Set(["dob", "ssn", "pin"]);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_EXACT_KEYS.has(lower)) return true;
  return SENSITIVE_KEY_FAMILIES.some((family) => lower.includes(family));
}

/** Keys that are dropped entirely (subtrees can hold request bodies etc.). */
const DROPPED_KEYS = new Set(["cookies", "data", "body", "request_body"]);

const REDACTED = "[scrubbed]";

/** djb2 — stable, non-reversible-enough tag for correlating users across events. */
function anonHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return `anon_${(hash >>> 0).toString(36)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scrubValue(key: string, value: unknown): unknown {
  if (isSensitiveKey(key)) return REDACTED;
  return scrubUnknown(value);
}

function scrubUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => scrubUnknown(entry));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (DROPPED_KEYS.has(key.toLowerCase())) continue;
      out[key] = scrubValue(key, entry);
    }
    return out;
  }
  return value;
}

/**
 * Minimal structural slice of a Sentry event — enough to scrub without
 * depending on @sentry/types in this package.
 */
export interface ScrubbableSentryEvent {
  user?: {
    id?: string | number;
    email?: string;
    username?: string;
    ip_address?: string;
    [key: string]: unknown;
  };
  request?: {
    cookies?: unknown;
    data?: unknown;
    headers?: Record<string, string>;
    query_string?: unknown;
    url?: string;
    [key: string]: unknown;
  };
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: Array<{ data?: unknown; message?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/**
 * Scrub a Sentry event in place-safe fashion (returns a new object for the
 * parts it touches). Pass directly as `beforeSend` — a `null` return is
 * never produced; we always deliver the (scrubbed) event so errors are not
 * silently lost.
 */
export function scrubSentryEvent<E extends object>(event: E): E {
  const out: ScrubbableSentryEvent = { ...(event as ScrubbableSentryEvent) };

  if (out.user) {
    const id = out.user.id;
    out.user = {
      // Hash the user id so events still correlate per-user without
      // carrying a real identifier. Everything else about the user goes.
      ...(id !== undefined && id !== null ? { id: anonHash(String(id)) } : {}),
    };
  }

  if (out.request) {
    const { cookies: _cookies, data: _data, headers, ...rest } = out.request;
    const scrubbedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers ?? {})) {
      scrubbedHeaders[key] = isSensitiveKey(key) ? REDACTED : value;
    }
    out.request = { ...rest, headers: scrubbedHeaders };
  }

  if (out.contexts) out.contexts = scrubUnknown(out.contexts) as Record<string, unknown>;
  if (out.extra) out.extra = scrubUnknown(out.extra) as Record<string, unknown>;
  if (out.tags) out.tags = scrubUnknown(out.tags) as Record<string, unknown>;
  if (out.breadcrumbs) {
    out.breadcrumbs = out.breadcrumbs.map((crumb) => ({
      ...crumb,
      ...(crumb.data !== undefined ? { data: scrubUnknown(crumb.data) } : {}),
    }));
  }

  return out as E;
}

/** Exported for tests + the observability audit. */
export const __scrubInternals = { isSensitiveKey, anonHash };
