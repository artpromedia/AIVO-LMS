/**
 * Retention "what would be deleted" preview (Sprint 5).
 *
 * Pure functions that, given a set of retention policies and a sample of
 * records (each with a data class and a creation timestamp), compute which
 * records have aged past their retention window and would be purged or
 * anonymized on the next sweep. The UI calls this for the dry-run preview
 * and the sweep job uses the same logic, so they can never diverge.
 */

export type Disposition = "purge" | "anonymize";

export interface RetentionPolicy {
  dataClass: string;
  /** Window in days; null/undefined = retain indefinitely (no auto-purge). */
  retentionDays: number | null;
  disposition: Disposition;
  legalHold: boolean;
}

export interface RetentionRecord {
  dataClass: string;
  recordId: string;
  createdAt: string | Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The cutoff instant: records created at or before this are past the
 * window. Returns null when retention is indefinite or under legal hold,
 * meaning nothing is eligible.
 */
export function retentionCutoff(
  policy: Pick<RetentionPolicy, "retentionDays" | "legalHold">,
  now: Date = new Date(),
): Date | null {
  if (policy.legalHold) return null;
  if (policy.retentionDays === null || policy.retentionDays === undefined) return null;
  return new Date(now.getTime() - policy.retentionDays * DAY_MS);
}

export function isEligible(
  record: RetentionRecord,
  policy: RetentionPolicy,
  now: Date = new Date(),
): boolean {
  const cutoff = retentionCutoff(policy, now);
  if (cutoff === null) return false;
  const created = new Date(record.createdAt).getTime();
  return created <= cutoff.getTime();
}

export interface ClassPreview {
  dataClass: string;
  disposition: Disposition;
  retentionDays: number | null;
  legalHold: boolean;
  cutoff: string | null;
  totalCount: number;
  eligibleCount: number;
  eligibleRecordIds: string[];
}

/**
 * Preview the next retention sweep. Records whose class has no policy are
 * reported under a synthesized "no-policy" entry with zero eligible (we
 * never delete a class nobody configured a rule for — fail safe).
 */
export function previewRetention(args: {
  policies: RetentionPolicy[];
  records: RetentionRecord[];
  now?: Date;
}): ClassPreview[] {
  const now = args.now ?? new Date();
  const byClass = new Map<string, RetentionPolicy>();
  for (const p of args.policies) byClass.set(p.dataClass, p);

  const classes = new Map<string, RetentionRecord[]>();
  for (const r of args.records) {
    const list = classes.get(r.dataClass) ?? [];
    list.push(r);
    classes.set(r.dataClass, list);
  }

  const out: ClassPreview[] = [];
  for (const [dataClass, records] of classes) {
    const policy = byClass.get(dataClass);
    if (!policy) {
      out.push({
        dataClass,
        disposition: "purge",
        retentionDays: null,
        legalHold: false,
        cutoff: null,
        totalCount: records.length,
        eligibleCount: 0,
        eligibleRecordIds: [],
      });
      continue;
    }
    const cutoff = retentionCutoff(policy, now);
    const eligible = records.filter((r) => isEligible(r, policy, now));
    out.push({
      dataClass,
      disposition: policy.disposition,
      retentionDays: policy.retentionDays,
      legalHold: policy.legalHold,
      cutoff: cutoff ? cutoff.toISOString() : null,
      totalCount: records.length,
      eligibleCount: eligible.length,
      eligibleRecordIds: eligible.map((r) => r.recordId),
    });
  }
  // Stable order for deterministic UI/tests.
  return out.sort((a, b) => a.dataClass.localeCompare(b.dataClass));
}

/** Roll a class-level preview up to a single headline number. */
export function totalEligible(previews: ClassPreview[]): number {
  return previews.reduce((sum, p) => sum + p.eligibleCount, 0);
}
