import { randomUUID } from "node:crypto";

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

export type ExportFormat = "json" | "markdown" | "csv_summary";

export interface ParentExportInput {
  learnerId: string;
  learnerProfileSummary: Record<string, unknown>;
  brainProfileSummary: Record<string, unknown>;
  approvedAccommodations: string[];
  recommendationHistory: Array<{
    id: string;
    type: string;
    status: string;
    decidedAt?: string;
  }>;
  baselineSummaries: Array<{ id: string; summary: string }>;
  lessonProgressSummaries: Array<{ id: string; subject: string; mastery: number }>;
  homeworkSummaries: Array<{ id: string; status: string }>;
  problemSessionSummaries: Array<{
    id: string;
    subject: string;
    attempts: number;
    successRate: number;
  }>;
  parentDecisions: Array<{ at: string; action: string; recommendationId?: string }>;
  teacherObservationsVisibleToParent: Array<{ id: string; summary: string }>;
  auditSummary: Record<string, number>;
}

export interface ExportArtifact {
  format: ExportFormat;
  filename: string;
  contents: string;
}

export interface ExportJob {
  id: string;
  learnerId: string;
  formats: ExportFormat[];
  artifacts: ExportArtifact[];
  createdAt: string;
}

function stripSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      out[key] = stripSensitive(nested);
    }
    return out;
  }
  return value;
}

function toMarkdown(input: ParentExportInput): string {
  const lines: string[] = [
    `# Learner Data Export`,
    ``,
    `**Learner**: ${input.learnerId}`,
    ``,
    `## Profile Summary`,
    "```json",
    JSON.stringify(stripSensitive(input.learnerProfileSummary), null, 2),
    "```",
    ``,
    `## Approved Accommodations`,
    ...input.approvedAccommodations.map((a) => `- ${a}`),
    ``,
    `## Recommendation History`,
    ...input.recommendationHistory.map((r) => `- ${r.id} (${r.type}) → ${r.status}`),
    ``,
    `## Lesson Progress`,
    ...input.lessonProgressSummaries.map(
      (s) => `- ${s.subject}: mastery ${Math.round(s.mastery * 100)}%`,
    ),
    ``,
    `## Problem Sessions`,
    ...input.problemSessionSummaries.map(
      (s) => `- ${s.subject}: ${s.attempts} attempts, ${(s.successRate * 100).toFixed(0)}% correct`,
    ),
    ``,
    `## Parent Decisions`,
    ...input.parentDecisions.map((d) => `- ${d.at}: ${d.action}`),
    ``,
    `## Audit Summary`,
    "```json",
    JSON.stringify(input.auditSummary, null, 2),
    "```",
  ];
  return lines.join("\n");
}

function toCsvSummary(input: ParentExportInput): string {
  const rows = [
    "section,key,value",
    `accommodations,count,${input.approvedAccommodations.length}`,
    `recommendations,count,${input.recommendationHistory.length}`,
    `lessons,count,${input.lessonProgressSummaries.length}`,
    `problem_sessions,count,${input.problemSessionSummaries.length}`,
    `parent_decisions,count,${input.parentDecisions.length}`,
  ];
  return rows.join("\n");
}

export function buildParentExport(input: ParentExportInput): ExportJob {
  const safe: ParentExportInput = JSON.parse(
    JSON.stringify(stripSensitive(input)),
  ) as ParentExportInput;
  const artifacts: ExportArtifact[] = [
    {
      format: "json",
      filename: `learner-${input.learnerId}.json`,
      contents: JSON.stringify(safe, null, 2),
    },
    {
      format: "markdown",
      filename: `learner-${input.learnerId}.md`,
      contents: toMarkdown(safe),
    },
    {
      format: "csv_summary",
      filename: `learner-${input.learnerId}-summary.csv`,
      contents: toCsvSummary(safe),
    },
  ];
  return {
    id: randomUUID(),
    learnerId: input.learnerId,
    formats: artifacts.map((a) => a.format),
    artifacts,
    createdAt: new Date().toISOString(),
  };
}
