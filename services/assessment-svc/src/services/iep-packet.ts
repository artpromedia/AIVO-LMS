/**
 * IEP packet generator.
 *
 * Builds a printable IEP packet (Markdown + HTML) from the data the
 * service already stores: learner demographics, IEP profile, goals, and
 * any uploaded source documents. The packet is the same structure every
 * U.S. district must produce for an IEP meeting:
 *
 *   1. Cover & demographics
 *   2. Present Levels of Academic Achievement & Functional Performance
 *   3. Annual goals with measurable benchmarks
 *   4. Special-education services / accommodations / modifications
 *   5. Participation & assessment accommodations
 *   6. Attendance / progress notes (this section is data-driven; if the
 *      caller passes none we render a placeholder)
 *   7. Signature blocks (parent / teacher / case manager / admin)
 *
 * The generator is pure: it takes plain input shapes (no Drizzle row
 * types, no Fastify request) and returns strings. The route layer
 * (`iep.ts`) loads from postgres and feeds it in. Unit tests exercise the
 * generator without hitting the database.
 */

export interface IepPacketLearner {
  id: string;
  fullName: string;
  dateOfBirth?: string;
  gradeBand?: string;
  studentId?: string;
  caseManagerName?: string;
  schoolName?: string;
  /** Functioning level (STANDARD / SUPPORTED / LOW_VERBAL / NON_VERBAL / PRE_SYMBOLIC). */
  functioningLevel?: string;
}

export interface IepPacketProfile {
  /** Free-form present-levels narrative — usually multiple paragraphs. */
  presentLevels?: string;
  /** Free-form list of accommodations — one per line. */
  accommodations?: string[];
  /** Modifications — material changes to curriculum (vs accommodations). */
  modifications?: string[];
  /** Assessment accommodations for state/district testing. */
  assessmentAccommodations?: string[];
  /** Free-form services list (e.g. "Speech 30min/wk"). */
  services?: Array<{ service: string; frequency: string; provider?: string }>;
  /** Free-form participation note (e.g. "80% of day in general ed"). */
  participation?: string;
  /** ISO-8601 effective date of the plan. */
  effectiveAt?: string;
  /** ISO-8601 next-review date. */
  nextReviewAt?: string;
}

export interface IepPacketGoal {
  id: string;
  /** The goal statement, e.g. "Sara will read 60 wpm with 90% accuracy". */
  statement: string;
  /** Skill / standard the goal aligns to. */
  alignment?: string;
  /** Measurable benchmarks (sub-objectives). */
  benchmarks?: string[];
  /** Most recent progress note — free-form. */
  progressNote?: string;
  /** Domain (academic / behavior / SEL / speech / ...). */
  domain?: string;
}

export interface IepPacketAttendance {
  /** ISO date. */
  date: string;
  /** "present" | "absent" | "tardy" | etc. */
  status: string;
  notes?: string;
}

export interface IepPacketInput {
  learner: IepPacketLearner;
  profile: IepPacketProfile;
  goals: IepPacketGoal[];
  attendance?: IepPacketAttendance[];
  /** Free-form district / authoring metadata. */
  meta?: { districtName?: string; preparedBy?: string; preparedAt?: string };
}

export interface IepPacket {
  markdown: string;
  html: string;
  /** Section count — surfaced for tests/observability. */
  sections: number;
}

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  // Strip the time portion if present.
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

/**
 * Roles that appear in the IEP packet's signature block. Extracted to a
 * module-level constant so a future change to the required signatories
 * (e.g. adding "Related-services provider") is a one-line edit.
 */
const SIGNATURE_ROLES = [
  "Parent / Guardian",
  "General-education teacher",
  "Special-education teacher",
  "Case manager",
  "School administrator",
] as const;

function bulletList(items: readonly string[] | undefined): string {
  if (!items || items.length === 0) return "_None on file._";
  return items.map((i) => `- ${i}`).join("\n");
}

/** Build the Markdown packet body. */
function buildMarkdown(input: IepPacketInput): string {
  const { learner, profile, goals, attendance, meta } = input;
  const lines: string[] = [];

  lines.push("# Individualized Education Program (IEP) Packet");
  if (meta?.districtName) lines.push(`*${meta.districtName}*`);
  lines.push("");

  // 1. Cover & demographics
  lines.push("## 1. Student Demographics");
  lines.push("");
  lines.push(`- **Name:** ${learner.fullName}`);
  lines.push(`- **Student ID:** ${learner.studentId ?? learner.id}`);
  lines.push(`- **Date of birth:** ${fmtDate(learner.dateOfBirth)}`);
  lines.push(`- **Grade band:** ${learner.gradeBand ?? "—"}`);
  lines.push(`- **School:** ${learner.schoolName ?? "—"}`);
  lines.push(`- **Case manager:** ${learner.caseManagerName ?? "—"}`);
  lines.push(`- **Functioning level:** ${learner.functioningLevel ?? "—"}`);
  if (profile.effectiveAt) lines.push(`- **Plan effective:** ${fmtDate(profile.effectiveAt)}`);
  if (profile.nextReviewAt) lines.push(`- **Next review:** ${fmtDate(profile.nextReviewAt)}`);
  lines.push("");

  // 2. Present levels
  lines.push("## 2. Present Levels of Academic Achievement and Functional Performance");
  lines.push("");
  lines.push(profile.presentLevels?.trim() || "_To be drafted by the IEP team._");
  lines.push("");

  // 3. Goals
  lines.push("## 3. Annual Goals");
  lines.push("");
  if (goals.length === 0) {
    lines.push("_No goals on file._");
  } else {
    for (const g of goals) {
      lines.push(`### Goal ${g.id}${g.domain ? ` (${g.domain})` : ""}`);
      lines.push("");
      lines.push(g.statement);
      if (g.alignment) lines.push(`- **Aligned to:** ${g.alignment}`);
      if (g.benchmarks && g.benchmarks.length > 0) {
        lines.push("- **Benchmarks:**");
        for (const b of g.benchmarks) lines.push(`  - ${b}`);
      }
      if (g.progressNote) lines.push(`- **Latest progress:** ${g.progressNote}`);
      lines.push("");
    }
  }

  // 4. Services / accommodations / modifications
  lines.push("## 4. Special Education Services and Accommodations");
  lines.push("");
  lines.push("### Services");
  if (!profile.services || profile.services.length === 0) {
    lines.push("_None on file._");
  } else {
    for (const s of profile.services) {
      lines.push(`- ${s.service} — ${s.frequency}${s.provider ? ` (${s.provider})` : ""}`);
    }
  }
  lines.push("");
  lines.push("### Accommodations");
  lines.push(bulletList(profile.accommodations));
  lines.push("");
  lines.push("### Modifications");
  lines.push(bulletList(profile.modifications));
  lines.push("");

  // 5. Participation
  lines.push("## 5. Participation in General Education and Assessment");
  lines.push("");
  lines.push(profile.participation?.trim() || "_To be drafted by the IEP team._");
  lines.push("");
  lines.push("### Assessment Accommodations");
  lines.push(bulletList(profile.assessmentAccommodations));
  lines.push("");

  // 6. Attendance / progress
  lines.push("## 6. Attendance and Progress");
  lines.push("");
  if (!attendance || attendance.length === 0) {
    lines.push("_No attendance records on file for this period._");
  } else {
    lines.push("| Date | Status | Notes |");
    lines.push("| --- | --- | --- |");
    for (const a of attendance) {
      lines.push(`| ${fmtDate(a.date)} | ${a.status} | ${a.notes ?? ""} |`);
    }
  }
  lines.push("");

  // 7. Signature blocks
  lines.push("## 7. Signatures");
  lines.push("");
  for (const role of SIGNATURE_ROLES) {
    lines.push(`- **${role}:** ____________________________  Date: __________`);
  }
  lines.push("");
  if (meta?.preparedBy || meta?.preparedAt) {
    lines.push(`_Prepared by ${meta.preparedBy ?? "—"} on ${fmtDate(meta.preparedAt)}._`);
  }

  return lines.join("\n");
}

function buildHtml(md: string): string {
  // Tiny markdown→HTML rendering. We deliberately do not pull in a full
  // markdown lib — packets stay pure ASCII and the structure is fixed.
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  for (const raw of lines) {
    const line = raw;
    if (/^# /.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (/^## /.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (/^### /.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (/^- /.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (/^\|/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (!inTable) { out.push("<table>"); inTable = true; }
      // Skip the markdown separator row.
      if (/^\|\s*-/.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      out.push("<tr>" + cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("") + "</tr>");
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inTable) { out.push("</table>"); inTable = false; }
      if (line.trim().length === 0) continue;
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  if (inTable) out.push("</table>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>IEP Packet</title></head><body>${out.join("")}</body></html>`;
}

export function buildIepPacket(input: IepPacketInput): IepPacket {
  if (!input.learner || !input.learner.id || !input.learner.fullName) {
    throw new Error("buildIepPacket: learner.id and learner.fullName are required");
  }
  const md = buildMarkdown(input);
  const html = buildHtml(md);
  // 7 fixed sections.
  return { markdown: md, html, sections: 7 };
}
