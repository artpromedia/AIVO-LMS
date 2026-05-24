/**
 * Sprint 1 (learner roadmap): validate optional homework attachments
 * submitted by the learner when starting a session. The form sends a
 * `{ mimeType, filename, dataBase64 }` triplet; this helper checks the
 * MIME against an allow-list and enforces a generous-but-bounded size
 * cap so the BFF route stays cheap.
 */
import type { HomeworkAttachment } from "@/lib/db/types";

/**
 * 10 MiB matches the mobile cap used in
 * apps/mobile/app/(learner)/homework/index.tsx so behaviour is consistent
 * across surfaces.
 */
export const MAX_HOMEWORK_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_HOMEWORK_MIME_TYPES: HomeworkAttachment["mimeType"][] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

export type ParseHomeworkAttachmentResult =
  | { ok: true; attachment: HomeworkAttachment }
  | { ok: false; reason: "invalid_shape" | "invalid_mime" | "invalid_base64" | "too_large" };

function isAllowedMime(value: unknown): value is HomeworkAttachment["mimeType"] {
  return (
    typeof value === "string" &&
    (ALLOWED_HOMEWORK_MIME_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Decoded byte size of a base64 string without allocating a Buffer for
 * the whole payload. Handles standard padding ("=", "==").
 */
export function base64ByteLength(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (b64.charCodeAt(len - 1) === 0x3d) padding++;
  if (len >= 2 && b64.charCodeAt(len - 2) === 0x3d) padding++;
  return Math.floor((len * 3) / 4) - padding;
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function parseHomeworkAttachment(value: unknown): ParseHomeworkAttachmentResult {
  if (!value || typeof value !== "object") {
    return { ok: false, reason: "invalid_shape" };
  }
  const v = value as Record<string, unknown>;
  if (!isAllowedMime(v.mimeType)) {
    return { ok: false, reason: "invalid_mime" };
  }
  if (typeof v.dataBase64 !== "string" || v.dataBase64.length === 0) {
    return { ok: false, reason: "invalid_base64" };
  }
  const dataBase64 = v.dataBase64;
  if (!BASE64_RE.test(dataBase64) || dataBase64.length % 4 !== 0) {
    return { ok: false, reason: "invalid_base64" };
  }
  const sizeBytes = base64ByteLength(dataBase64);
  if (sizeBytes <= 0) {
    return { ok: false, reason: "invalid_base64" };
  }
  if (sizeBytes > MAX_HOMEWORK_ATTACHMENT_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  const filename =
    typeof v.filename === "string" && v.filename.length > 0 && v.filename.length <= 255
      ? v.filename
      : null;
  return {
    ok: true,
    attachment: {
      mimeType: v.mimeType,
      filename,
      sizeBytes,
      dataBase64,
    },
  };
}

/**
 * Human-readable label for the chip rendered next to a homework session.
 * Keeps numbers short ("1.2 MB", "640 KB") and never exceeds two parts.
 */
export function describeHomeworkAttachment(a: HomeworkAttachment): string {
  const kb = a.sizeBytes / 1024;
  const sizeLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  if (a.filename) return `${a.filename} · ${sizeLabel}`;
  const kind = a.mimeType === "application/pdf" ? "PDF" : "Photo";
  return `${kind} · ${sizeLabel}`;
}
