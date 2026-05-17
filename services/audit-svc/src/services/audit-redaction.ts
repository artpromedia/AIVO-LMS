/**
 * PII redactor for audit metadata.
 *
 * Sprint 09 shipped an allowlist of 14 keys. Production hardening
 * expands that allowlist substantially and adds value-pattern scanning
 * for common PII formats (email addresses, US SSNs, US phone numbers,
 * credit-card-shaped strings, JWT-shaped strings, common API-key
 * prefixes) so even an unanticipated key with a sensitive value is
 * redacted.
 *
 * The redactor is intentionally conservative: when in doubt, redact.
 * Audit metadata exists for forensics, not for downstream analytics.
 */

const SENSITIVE_KEY_PATTERN =
  /(?:^|_|-|\.)(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|credential|session[_-]?id|cookie|otp|mfa|pin)(?:$|_|-|\.)/i;

const SENSITIVE_KEYS = new Set<string>([
  // PII free-form text (Sprint 09 baseline)
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
  // Identity / contact (production hardening)
  "ssn",
  "socialSecurityNumber",
  "dob",
  "dateOfBirth",
  "birthDate",
  "homeAddress",
  "address",
  "streetAddress",
  "zipCode",
  "postalCode",
  "phoneNumber",
  "homePhone",
  "mobilePhone",
  "parentEmail",
  "guardianEmail",
  "emergencyContact",
  // Auth + secrets
  "password",
  "passwd",
  "pwd",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "id_token",
  "secret",
  "apiKey",
  "api_key",
  "privateKey",
  "private_key",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "sessionId",
  "cookie",
  "authorization",
  "otp",
  "mfaCode",
  "pin",
  // Clinical / governance
  "diagnosisCode",
  "icd10",
  "icd11",
  "medication",
  "insuranceNumber",
  "iepAccommodationsText",
  "raw504Text",
  "raw504Plan",
  // Free-form learner content
  "essayText",
  "journalEntry",
  "uploadedFileContent",
  "chatTranscript",
]);

const MAX_STRING_LENGTH = 240;

// Value-pattern scanners. Each returns true if the value should be
// redacted regardless of the key under which it was found.
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const US_SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const US_PHONE_RE = /\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const CREDIT_CARD_RE = /\b(?:\d[ -]*?){13,19}\b/;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/;
const API_KEY_PREFIX_RE = /\b(?:sk|pk|rk|ak)_(?:live|test)_[A-Za-z0-9]{16,}\b/;
const BEARER_TOKEN_RE = /\bBearer\s+[A-Za-z0-9._\-+/=]{20,}\b/i;

function valueLooksSensitive(value: string): boolean {
  if (value.length === 0) return false;
  return (
    EMAIL_RE.test(value) ||
    US_SSN_RE.test(value) ||
    US_PHONE_RE.test(value) ||
    CREDIT_CARD_RE.test(value) ||
    JWT_RE.test(value) ||
    API_KEY_PREFIX_RE.test(value) ||
    BEARER_TOKEN_RE.test(value)
  );
}

function keyLooksSensitive(key: string): boolean {
  if (SENSITIVE_KEYS.has(key)) return true;
  return SENSITIVE_KEY_PATTERN.test(key);
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (valueLooksSensitive(value)) return "[redacted]";
    if (value.length > MAX_STRING_LENGTH) {
      return `${value.slice(0, MAX_STRING_LENGTH)}…`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }
  if (value && typeof value === "object") {
    return redactAuditMetadata(value as Record<string, unknown>);
  }
  return value;
}

export function redactAuditMetadata(
  metadata: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (keyLooksSensitive(key)) {
      result[key] = "[redacted]";
      continue;
    }
    result[key] = redactValue(value);
  }
  return result;
}

/**
 * Quick PII check used by callers that want to scan a single value
 * (e.g. before logging a tutor message in error path). Exported so
 * downstream services don't reimplement the patterns.
 */
export function looksLikePii(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return valueLooksSensitive(value);
}
