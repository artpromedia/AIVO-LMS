/**
 * Allowlist redaction for audit `details` (Sprint 3).
 *
 * Audit details must never leak secrets or excess PII, so producers pass an
 * explicit allowlist of keys to retain; everything else is dropped. As a
 * defense-in-depth backstop, any retained key whose name matches a secret
 * pattern is masked even if allowlisted by mistake.
 */
const SECRET_KEY = /(secret|password|token|authorization|cookie|ssn|client_secret|private_key|api[_-]?key)/i;

export function redactDetails(
  details: Record<string, unknown> | undefined,
  allowlist: readonly string[],
): Record<string, unknown> {
  if (!details) return {};
  const allow = new Set(allowlist);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(details)) {
    if (!allow.has(key)) continue;
    out[key] = SECRET_KEY.test(key) ? "[REDACTED]" : details[key];
  }
  return out;
}

/** Mask secret-looking values recursively (used on details that aren't allowlisted upstream). */
export function maskSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => maskSecrets(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "[REDACTED]" : maskSecrets(v);
    }
    return out as unknown as T;
  }
  return value;
}
