/**
 * Safe-logging helper that refuses to emit raw IEP / parent / medical /
 * OCR / free-form chat text. Use this for any structured log payload that
 * touches learner-facing flows.
 *
 * Production-hardened: the redactor now also catches PII value patterns
 * (email, US SSN, US phone, JWT, API-key prefix, bearer token) so an
 * unanticipated key name with a sensitive value is still redacted, and
 * matches a broader allowlist of sensitive key names.
 */

const SENSITIVE_KEY_PATTERN =
  /(?:^|_|-|\.)(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|credential|session[_-]?id|cookie|otp|mfa|pin)(?:$|_|-|\.)/i;

const SENSITIVE_KEYS = new Set<string>([
  "iepText",
  "rawIepText",
  "parentPrivateNotes",
  "parentNotes",
  "medicalNotes",
  "medicalDiagnosis",
  "freeFormChat",
  "learnerChat",
  "ocrText",
  "uploadedOcrText",
  "rawText",
  "ssn",
  "socialSecurityNumber",
  "dob",
  "dateOfBirth",
  "homeAddress",
  "phoneNumber",
  "parentEmail",
  "guardianEmail",
  "emergencyContact",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
  "privateKey",
  "credential",
  "credentials",
  "sessionId",
  "cookie",
  "authorization",
  "otp",
  "mfaCode",
  "pin",
]);

const MAX_STRING_LENGTH = 240;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const US_SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const US_PHONE_RE = /\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/;
const API_KEY_PREFIX_RE = /\b(?:sk|pk|rk|ak)_(?:live|test)_[A-Za-z0-9]{16,}\b/;
const BEARER_TOKEN_RE = /\bBearer\s+[A-Za-z0-9._\-+/=]{20,}\b/i;

function valueLooksSensitive(value: string): boolean {
  if (value.length === 0) return false;
  return (
    EMAIL_RE.test(value) ||
    US_SSN_RE.test(value) ||
    US_PHONE_RE.test(value) ||
    JWT_RE.test(value) ||
    API_KEY_PREFIX_RE.test(value) ||
    BEARER_TOKEN_RE.test(value)
  );
}

function keyLooksSensitive(key: string): boolean {
  if (SENSITIVE_KEYS.has(key)) return true;
  return SENSITIVE_KEY_PATTERN.test(key);
}

export interface SafeLogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  payload: Record<string, unknown>;
}

export function redactForLogging(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (keyLooksSensitive(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactForLogging(value as Record<string, unknown>);
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((entry) => {
        if (entry && typeof entry === "object") {
          return redactForLogging(entry as Record<string, unknown>);
        }
        if (typeof entry === "string" && (valueLooksSensitive(entry) || entry.length > MAX_STRING_LENGTH)) {
          return valueLooksSensitive(entry)
            ? "[redacted]"
            : `${entry.slice(0, MAX_STRING_LENGTH)}…`;
        }
        return entry;
      });
      continue;
    }
    if (typeof value === "string") {
      if (valueLooksSensitive(value)) {
        out[key] = "[redacted]";
        continue;
      }
      if (value.length > MAX_STRING_LENGTH) {
        out[key] = `${value.slice(0, MAX_STRING_LENGTH)}…`;
        continue;
      }
    }
    out[key] = value;
  }
  return out;
}

export function buildSafeLogEntry(
  level: SafeLogEntry["level"],
  message: string,
  payload: Record<string, unknown> = {},
): SafeLogEntry {
  return { level, message, payload: redactForLogging(payload) };
}
