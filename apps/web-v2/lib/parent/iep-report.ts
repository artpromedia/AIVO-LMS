/**
 * Parent IEP / progress report — data + PDF render (BACKEND-WIRING design-only
 * #3, "Download PDF").
 *
 * `buildIepReportData` reads the same real, truthful values the on-screen IEP
 * card and `/parent/reports` show (via `computeLearnerReportKpis`) plus the
 * learner's accepted supports and recent completed lessons. `renderIepReportPdf`
 * lays that out into a valid single-page PDF using the dependency-free writer
 * in `lib/pdf/simple-pdf.ts`.
 *
 * The PDF is English/Latin (the standard Helvetica font can't render CJK/RTL —
 * see `simple-pdf.ts`); on-screen UI localization is unaffected.
 */
import { getIEPForLearner, getLearner, listLessonRunsForLearner, listSubjects } from "@/lib/db/repos";
import { computeLearnerReportKpis, type SubjectProgress } from "@/lib/parent/report-kpis";
import { renderPdf, PAGE, type PdfCmd, type RGB } from "@/lib/pdf/simple-pdf";

export interface IepReportData {
  learnerName: string;
  gradeLabel: string | null;
  generatedAtLabel: string;
  overallMasteryPct: number;
  overallMasteryDeltaPct: number | null;
  completedCount: number;
  completedDeltaPct: number | null;
  iepSupportsCount: number;
  iepActive: boolean;
  subjectProgress: SubjectProgress[];
  accommodations: string[];
  recentLessons: Array<{ subject: string; dateLabel: string }>;
}

const MAX_SUPPORTS = 8;
const MAX_RECENT = 6;
/** Latin-safe date formatter — the PDF font only renders Latin glyphs. */
const REPORT_DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export async function buildIepReportData(
  learnerId: string,
  tenantId: string,
): Promise<IepReportData> {
  const [learner, kpis, iep, runs, subjects] = await Promise.all([
    getLearner(learnerId, tenantId),
    computeLearnerReportKpis(learnerId, tenantId),
    getIEPForLearner(learnerId, tenantId),
    listLessonRunsForLearner(learnerId, tenantId),
    listSubjects(),
  ]);
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  const recentLessons = runs
    .filter((r) => r.status === "completed" && r.completedAt)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, MAX_RECENT)
    .map((r) => ({
      subject: subjectName.get(r.subjectId) ?? r.subjectId,
      dateLabel: REPORT_DATE.format(new Date(r.completedAt as string)),
    }));

  return {
    learnerName: learner?.displayName ?? "Learner",
    gradeLabel: learner?.gradeBand ? `Grade ${learner.gradeBand}` : null,
    generatedAtLabel: REPORT_DATE.format(new Date()),
    overallMasteryPct: kpis.overallMasteryPct,
    overallMasteryDeltaPct: kpis.overallMasteryDeltaPct,
    completedCount: kpis.completedCount,
    completedDeltaPct: kpis.completedDeltaPct,
    iepSupportsCount: kpis.iepSupportsCount,
    iepActive: kpis.iepActive,
    subjectProgress: kpis.subjectProgress,
    accommodations: (iep?.acceptedAccommodations ?? []).slice(0, MAX_SUPPORTS),
    recentLessons,
  };
}

// --- layout palette (brand colors as 0..1 RGB) ---
const INK: RGB = [0.12, 0.106, 0.086];
const MUTED: RGB = [0.541, 0.514, 0.471];
const PURPLE: RGB = [0.486, 0.227, 0.929];
const TEAL: RGB = [0.051, 0.58, 0.533];
const GREEN: RGB = [0.063, 0.725, 0.506];
const TRACK: RGB = [0.945, 0.925, 0.886];
const BAR_COLORS: RGB[] = [GREEN, TEAL, PURPLE];
const MARGIN = 54;
const WRAP_CHARS = 92;

function deltaStr(delta: number | null): string {
  if (delta == null) return "";
  return ` (${delta >= 0 ? "+" : ""}${delta}% vs 30d)`;
}

function wrapText(s: string, max = WRAP_CHARS): string[] {
  if (s.length <= max) return [s];
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > max) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Pure: lay out the report data into a single-page PDF buffer. */
export function renderIepReportPdf(d: IepReportData): Buffer {
  const cmds: PdfCmd[] = [];
  let y = PAGE.height - MARGIN;
  const text = (
    value: string,
    opts: { size?: number; bold?: boolean; color?: RGB; x?: number } = {},
    gapAfter?: number,
  ) => {
    const size = opts.size ?? 11;
    cmds.push({
      kind: "text",
      x: opts.x ?? MARGIN,
      y,
      size,
      text: value,
      bold: opts.bold,
      color: opts.color ?? INK,
    });
    y -= gapAfter ?? size + 6;
  };

  // Header
  text("IEP Progress Report", { size: 22, bold: true }, 12);
  const sub = [d.learnerName, d.gradeLabel, `Generated ${d.generatedAtLabel}`]
    .filter(Boolean)
    .join("   ·   ");
  text(sub, { size: 11, color: MUTED }, 26);

  // Summary
  text("Summary", { size: 13, bold: true }, 18);
  text(`Overall mastery: ${d.overallMasteryPct}%${deltaStr(d.overallMasteryDeltaPct)}`);
  text(`Lessons completed: ${d.completedCount}${deltaStr(d.completedDeltaPct)}`);
  text(
    `IEP supports: ${
      d.iepSupportsCount > 0
        ? `${d.iepSupportsCount} ${d.iepActive ? "active" : "on file"}`
        : "none on file"
    }`,
    {},
    24,
  );

  // Skill mastery bars
  text("Skill mastery", { size: 13, bold: true }, 18);
  if (d.subjectProgress.length === 0) {
    text("No subject mastery recorded yet.", { color: MUTED }, 20);
  } else {
    const barW = PAGE.width - MARGIN * 2;
    for (let i = 0; i < d.subjectProgress.length; i += 1) {
      const s = d.subjectProgress[i];
      cmds.push({ kind: "text", x: MARGIN, y, size: 11, text: s.subject, color: INK });
      cmds.push({
        kind: "text",
        x: PAGE.width - MARGIN - 32,
        y,
        size: 11,
        text: `${s.pct}%`,
        bold: true,
        color: INK,
      });
      y -= 12;
      cmds.push({ kind: "rect", x: MARGIN, y: y - 2, w: barW, h: 7, color: TRACK });
      cmds.push({
        kind: "rect",
        x: MARGIN,
        y: y - 2,
        w: Math.max(2, (barW * s.pct) / 100),
        h: 7,
        color: BAR_COLORS[i % BAR_COLORS.length],
      });
      y -= 22;
    }
  }
  y -= 6;

  // Active supports
  text("Active supports", { size: 13, bold: true }, 18);
  if (d.accommodations.length === 0) {
    text("No supports on file yet.", { color: MUTED }, 20);
  } else {
    for (const a of d.accommodations) {
      const lines = wrapText(`•  ${a}`);
      for (const ln of lines) text(ln, { size: 11 }, 16);
    }
    y -= 6;
  }

  // Recent lessons
  text("Recent lessons", { size: 13, bold: true }, 18);
  if (d.recentLessons.length === 0) {
    text("No completed lessons yet.", { color: MUTED }, 16);
  } else {
    for (const l of d.recentLessons) text(`•  ${l.subject} — ${l.dateLabel}`, { size: 11 }, 16);
  }

  // Footer disclaimer
  cmds.push({
    kind: "text",
    x: MARGIN,
    y: MARGIN - 8,
    size: 9,
    color: MUTED,
    text: `Every number is read from real learning data and aligned to ${d.learnerName}'s IEP goals — starting points for planning, not grades.`,
  });

  return renderPdf(cmds);
}
