import { z } from "zod";

/**
 * Sprint 6: IEP upload + extraction validators.
 *
 * The upload metadata schema is enforced before we accept the multipart file
 * stream so we can reject oversized / wrong-MIME uploads without ever buffering
 * the body. The extraction schema is what the AI adapter (or deterministic
 * fallback) must return, and is validated before persistence so we never store
 * partial / malformed accommodation data.
 */
export const IEP_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const IEP_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export const iepUploadMetaSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.enum(IEP_ALLOWED_MIME_TYPES),
  bytes: z.number().int().min(1).max(IEP_MAX_BYTES),
});
export type IEPUploadMeta = z.infer<typeof iepUploadMetaSchema>;

export const iepExtractionSchema = z.object({
  accommodations: z.array(z.string().max(300)).max(40),
  serviceAreas: z.array(z.string().max(120)).max(20),
  learningGoals: z.array(z.string().max(300)).max(20),
  assistiveTechnologyNeeds: z.array(z.string().max(200)).max(20),
  extendedTime: z.boolean(),
  readingSupport: z.boolean(),
  writingSupport: z.boolean(),
  behavioralSupport: z.boolean(),
  sensorySupport: z.boolean(),
  communicationSupport: z.boolean(),
  learnerSafeSummary: z.string().min(1).max(800),
  parentSummary: z.string().min(1).max(2000),
  teacherSummary: z.string().min(1).max(2000),
  generatedAt: z.string(),
  source: z.enum(["ai_extraction", "fallback_from_assessment", "manual"]),
});
export type IEPExtractionInput = z.infer<typeof iepExtractionSchema>;
