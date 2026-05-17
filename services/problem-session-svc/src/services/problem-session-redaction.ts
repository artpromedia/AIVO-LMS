const SENSITIVE_KEYS = new Set([
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
]);

const SENSITIVE_SUMMARY_FALLBACK = "[redacted]";

const MAX_SUMMARY_LENGTH = 200;

export interface RedactionResult {
  redactedPayload: Record<string, unknown>;
  redactedKeys: string[];
}

export function redactSensitivePayload(
  payload: Record<string, unknown> | null | undefined,
): RedactionResult {
  if (!payload || typeof payload !== "object") {
    return { redactedPayload: {}, redactedKeys: [] };
  }
  const result: Record<string, unknown> = {};
  const redactedKeys: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = SENSITIVE_SUMMARY_FALLBACK;
      redactedKeys.push(key);
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = redactSensitivePayload(value as Record<string, unknown>);
      result[key] = nested.redactedPayload;
      redactedKeys.push(...nested.redactedKeys.map((k) => `${key}.${k}`));
      continue;
    }
    if (typeof value === "string" && value.length > MAX_SUMMARY_LENGTH) {
      result[key] = `${value.slice(0, MAX_SUMMARY_LENGTH)}…`;
      continue;
    }
    result[key] = value;
  }
  return { redactedPayload: result, redactedKeys };
}

export function safeSummary(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_SUMMARY_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_SUMMARY_LENGTH)}…`;
}
