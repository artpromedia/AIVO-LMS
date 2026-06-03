/**
 * Deterministic seed dataset for the initial report set (Sprint 10).
 *
 * In production each report's resolver calls the owning service (tenant-svc,
 * billing-svc, identity-svc, …). For local/dev/test runs the resolvers read
 * this fixed dataset so reports are reproducible and snapshot-testable, and so
 * the "all reports run < 30s on seeded data" DoD check is meaningful without a
 * live backend.
 */

export interface SeedTenant {
  tenantId: string;
  districtId: string;
  schoolId: string;
  name: string;
  plan: "free" | "starter" | "growth" | "enterprise";
  createdAt: string;
  seatsLicensed: number;
  seatsActive: number;
  mrrUsd: number;
  dau: number;
  wau: number;
  mau: number;
  enrollment: number;
  sisLastSyncAt: string;
  sisStatus: "healthy" | "degraded" | "failed";
  dsarOpen: number;
  dsarClosed: number;
  learningMinutes: number;
  interventions: number;
  attendanceProxyPct: number;
}

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

export const SEED_TENANTS: SeedTenant[] = [
  {
    tenantId: "tenant-springfield",
    districtId: "district-springfield",
    schoolId: "school-springfield-elem",
    name: "Springfield Elementary",
    plan: "growth",
    createdAt: iso(420),
    seatsLicensed: 500,
    seatsActive: 437,
    mrrUsd: 2495,
    dau: 180,
    wau: 320,
    mau: 437,
    enrollment: 437,
    sisLastSyncAt: iso(0),
    sisStatus: "healthy",
    dsarOpen: 1,
    dsarClosed: 12,
    learningMinutes: 58_200,
    interventions: 34,
    attendanceProxyPct: 0.94,
  },
  {
    tenantId: "tenant-shelbyville",
    districtId: "district-springfield",
    schoolId: "school-shelbyville-mid",
    name: "Shelbyville Middle",
    plan: "starter",
    createdAt: iso(300),
    seatsLicensed: 300,
    seatsActive: 210,
    mrrUsd: 990,
    dau: 95,
    wau: 165,
    mau: 210,
    enrollment: 210,
    sisLastSyncAt: iso(2),
    sisStatus: "degraded",
    dsarOpen: 0,
    dsarClosed: 5,
    learningMinutes: 24_900,
    interventions: 18,
    attendanceProxyPct: 0.89,
  },
  {
    tenantId: "tenant-riverdale",
    districtId: "district-riverdale",
    schoolId: "school-riverdale-high",
    name: "Riverdale High",
    plan: "enterprise",
    createdAt: iso(180),
    seatsLicensed: 1200,
    seatsActive: 1130,
    mrrUsd: 7980,
    dau: 540,
    wau: 880,
    mau: 1130,
    enrollment: 1130,
    sisLastSyncAt: iso(1),
    sisStatus: "healthy",
    dsarOpen: 3,
    dsarClosed: 20,
    learningMinutes: 142_700,
    interventions: 76,
    attendanceProxyPct: 0.91,
  },
];

/** Synthetic incident-frequency series for the platform incident report. */
export const SEED_INCIDENTS = [
  { month: "2026-01", count: 4, sev1: 0, sev2: 1 },
  { month: "2026-02", count: 2, sev1: 0, sev2: 0 },
  { month: "2026-03", count: 5, sev1: 1, sev2: 2 },
  { month: "2026-04", count: 3, sev1: 0, sev2: 1 },
  { month: "2026-05", count: 1, sev1: 0, sev2: 0 },
];
