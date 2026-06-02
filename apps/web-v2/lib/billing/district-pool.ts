/**
 * District seat-pool data layer for the web BFF/pages (Sprint 4).
 *
 * Self-contained, in-memory, and lazily seeded per district so it can layer
 * on top of the existing mock repo without threading new tables through the
 * 6k-line `lib/db/repos.ts`. The allocation invariant mirrors the canonical
 * backend domain (`services/billing-svc/src/domain/seats.ts`) and ADR 0033:
 * the sum of every school's allocation can never exceed `pool.total`.
 *
 * The module-level `state` Map is a singleton within the Next.js server
 * process, so a mutation made by a district admin (allocating seats) is
 * visible to a subsequent school-admin read — which is exactly what the
 * cross-role e2e relies on.
 */
import { getTenantById, scopeTenantsForSession } from "@/lib/db/repos";

export interface SchoolAllocation {
  schoolId: string;
  schoolName: string;
  allocated: number;
  used: number;
}

export interface DistrictPool {
  districtId: string;
  planId: string;
  status: "active" | "past_due" | "trialing" | "canceled";
  total: number;
  allocated: number;
  used: number;
  hardCap: number | null;
  renewalDate: string;
  /** Per-seat list price in cents/month, for MRR/ARR rollups. */
  perSeatCents: number;
}

export interface DistrictInvoice {
  id: string;
  number: string;
  status: "paid" | "open" | "void" | "uncollectible";
  amountCents: number;
  currency: "usd";
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  paidAt: string | null;
}

export interface SeatRequestTicket {
  id: string;
  schoolId: string;
  districtId: string;
  requestedBy: string;
  currentSeats: number;
  requestedSeats: number;
  justification: string;
  status: "open" | "approved" | "denied";
  createdAt: string;
}

interface DistrictState {
  pool: DistrictPool;
  schools: Map<string, SchoolAllocation>;
  invoices: DistrictInvoice[];
  /** Future-dated, not-yet-effective allocation moves, for display. */
  pending: Array<{
    fromSchoolId: string | null;
    toSchoolId: string;
    count: number;
    effectiveAt: string;
  }>;
}

const state = new Map<string, DistrictState>();
const seatRequests = new Map<string, SeatRequestTicket>();

const DAY = 24 * 60 * 60 * 1000;

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Child schools of a district, read from the live tenant graph. */
function childSchools(districtId: string): Array<{ id: string; name: string }> {
  const district = getTenantById(districtId);
  const role = district ? "district_admin" : "platform_admin";
  return scopeTenantsForSession(role, districtId)
    .filter((t) => t.type === "school" && t.parentTenantId === districtId)
    .map((t) => ({ id: t.id, name: t.name }));
}

/** Lazily seed a coherent pool for a district on first access. */
function ensureDistrict(districtId: string): DistrictState {
  const existing = state.get(districtId);
  if (existing) return existing;

  const district = getTenantById(districtId);
  const schools = childSchools(districtId);
  const seed = hashSeed(districtId);
  // Total contracted seats: a round number comfortably above seeded usage.
  const total = 600;
  const perSeatCents = 1000;

  const schoolMap = new Map<string, SchoolAllocation>();
  // Distribute ~85% of the pool across the schools deterministically; keep
  // the remainder unallocated so the matrix has headroom to move seats into.
  const base = schools.length > 0 ? Math.floor((total * 0.85) / schools.length / 10) * 10 : 0;
  schools.forEach((s, i) => {
    const allocated = Math.max(0, base + ((seed >> (i * 3)) % 5) * 10);
    const used = Math.max(0, allocated - 10 + ((seed >> (i * 2)) % 25));
    schoolMap.set(s.id, { schoolId: s.id, schoolName: s.name, allocated, used });
  });

  const allocated = Array.from(schoolMap.values()).reduce((sum, s) => sum + s.allocated, 0);
  const used = Array.from(schoolMap.values()).reduce((sum, s) => sum + s.used, 0);

  const now = Date.now();
  const invoices: DistrictInvoice[] = Array.from({ length: 6 }, (_, k) => {
    const start = new Date(now - (6 - k) * 30 * DAY);
    const end = new Date(now - (5 - k) * 30 * DAY);
    const isLatest = k === 5;
    return {
      id: `inv_${districtId}_${k}`,
      number: `INV-${district?.name?.slice(0, 3).toUpperCase() ?? "DST"}-${String(k + 1).padStart(4, "0")}`,
      status: isLatest ? "open" : "paid",
      amountCents: allocated * perSeatCents,
      currency: "usd",
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      issuedAt: start.toISOString(),
      paidAt: isLatest ? null : end.toISOString(),
    };
  });

  const next: DistrictState = {
    pool: {
      districtId,
      planId: "district",
      status: "active",
      total,
      allocated,
      used,
      hardCap: null,
      renewalDate: new Date(now + 90 * DAY).toISOString(),
      perSeatCents,
    },
    schools: schoolMap,
    invoices,
    pending: [],
  };
  state.set(districtId, next);
  return next;
}

function recomputePoolTotals(st: DistrictState): void {
  st.pool.allocated = Array.from(st.schools.values()).reduce((s, a) => s + a.allocated, 0);
  st.pool.used = Array.from(st.schools.values()).reduce((s, a) => s + a.used, 0);
}

// ── MRR / ARR (mirrors the backend domain) ──────────────────────────────────

export function mrrCents(pool: DistrictPool): number {
  if (pool.status !== "active" && pool.status !== "past_due") return 0;
  return pool.total * pool.perSeatCents;
}
export function arrCents(pool: DistrictPool): number {
  return mrrCents(pool) * 12;
}

// ── Read APIs ────────────────────────────────────────────────────────────────

export function getDistrictSummary(districtId: string) {
  const st = ensureDistrict(districtId);
  return {
    districtId,
    plan: st.pool.planId,
    status: st.pool.status,
    renewalDate: st.pool.renewalDate,
    seats: { total: st.pool.total, allocated: st.pool.allocated, used: st.pool.used },
    mrrCents: mrrCents(st.pool),
    arrCents: arrCents(st.pool),
    currency: "usd" as const,
  };
}

export function getDistrictPool(districtId: string) {
  const st = ensureDistrict(districtId);
  return {
    pool: { ...st.pool },
    allocations: Array.from(st.schools.values()).map((s) => ({ ...s })),
    pending: st.pending.map((p) => ({ ...p })),
    unallocated: st.pool.total - st.pool.allocated,
  };
}

export function listDistrictInvoices(
  districtId: string,
  range?: { from?: string; to?: string },
): DistrictInvoice[] {
  const st = ensureDistrict(districtId);
  let rows = st.invoices.slice();
  if (range?.from && !Number.isNaN(Date.parse(range.from))) {
    const from = Date.parse(range.from);
    rows = rows.filter((i) => Date.parse(i.issuedAt) >= from);
  }
  if (range?.to && !Number.isNaN(Date.parse(range.to))) {
    const to = Date.parse(range.to);
    rows = rows.filter((i) => Date.parse(i.issuedAt) <= to);
  }
  return rows.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export function getDistrictInvoice(districtId: string, invoiceId: string): DistrictInvoice | null {
  const st = ensureDistrict(districtId);
  return st.invoices.find((i) => i.id === invoiceId) ?? null;
}

/**
 * A minimal but valid single-page PDF for the invoice, generated on the
 * fly. Stands in for the object-storage-cached, signed-URL-distributed PDF
 * the backend serves (ADR 0033) so the download works end-to-end in the
 * mock environment.
 */
export function renderInvoicePdf(districtId: string, invoiceId: string): Buffer | null {
  const inv = getDistrictInvoice(districtId, invoiceId);
  if (!inv) return null;
  const district = getTenantById(districtId);
  const lines = [
    `AIVO Learning — Invoice ${inv.number}`,
    `District: ${district?.name ?? districtId}`,
    `Status: ${inv.status}`,
    `Period: ${inv.periodStart.slice(0, 10)} to ${inv.periodEnd.slice(0, 10)}`,
    `Amount: $${(inv.amountCents / 100).toFixed(2)} ${inv.currency.toUpperCase()}`,
  ];
  const content = lines
    .map((l, i) => `BT /F1 12 Tf 50 ${760 - i * 20} Td (${l.replace(/[()\\]/g, "")}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

export function getUtilizationSeries(districtId: string, granularity: "day" | "month") {
  const st = ensureDistrict(districtId);
  const points = granularity === "month" ? 6 : 30;
  const stepMs = granularity === "month" ? 30 * DAY : DAY;
  const now = Date.now();
  const seed = hashSeed(districtId);
  const series = Array.from({ length: points }, (_, k) => {
    const at = new Date(now - (points - 1 - k) * stepMs);
    // Gently trend usage up toward the current `used`, with light noise.
    const t = k / Math.max(1, points - 1);
    const wobble = ((seed >> (k % 16)) % 11) - 5;
    const used = Math.max(0, Math.round(st.pool.used * (0.7 + 0.3 * t) + wobble));
    return {
      period: at.toISOString().slice(0, granularity === "month" ? 7 : 10),
      used,
      allocated: st.pool.allocated,
    };
  });
  return {
    districtId,
    granularity,
    series,
    overage: Math.max(0, st.pool.used - st.pool.allocated),
    hardCap: st.pool.hardCap,
  };
}

// ── Allocation (invariant-enforcing mutation) ────────────────────────────────

export type AllocateResult =
  | { ok: true; pool: ReturnType<typeof getDistrictPool> }
  | {
      ok: false;
      reason:
        | "exceeds_pool_total"
        | "insufficient_source"
        | "unknown_school"
        | "non_positive_count"
        | "invalid_effective_at";
    };

export function allocateSeats(input: {
  districtId: string;
  fromSchoolId: string | null;
  toSchoolId: string;
  count: number;
  effectiveAt?: string;
}): AllocateResult {
  const st = ensureDistrict(input.districtId);
  const { fromSchoolId, toSchoolId, count } = input;
  if (!Number.isInteger(count) || count <= 0) return { ok: false, reason: "non_positive_count" };

  const to = st.schools.get(toSchoolId);
  if (!to) return { ok: false, reason: "unknown_school" };

  const effectiveAt = input.effectiveAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(effectiveAt))) return { ok: false, reason: "invalid_effective_at" };
  // Future-dated moves are recorded but not yet folded into live allocations.
  if (Date.parse(effectiveAt) > Date.now()) {
    st.pending.push({ fromSchoolId, toSchoolId, count, effectiveAt });
    return { ok: true, pool: getDistrictPool(input.districtId) };
  }

  if (fromSchoolId === null) {
    // Grant from the unallocated remainder.
    const unallocated = st.pool.total - st.pool.allocated;
    if (count > unallocated) return { ok: false, reason: "exceeds_pool_total" };
    to.allocated += count;
  } else {
    const from = st.schools.get(fromSchoolId);
    if (!from) return { ok: false, reason: "unknown_school" };
    if (count > from.allocated) return { ok: false, reason: "insufficient_source" };
    from.allocated -= count;
    to.allocated += count;
  }
  recomputePoolTotals(st);
  return { ok: true, pool: getDistrictPool(input.districtId) };
}

export function setHardCap(districtId: string, hardCap: number | null): void {
  ensureDistrict(districtId).pool.hardCap = hardCap;
}

// ── School-side view + seat requests ─────────────────────────────────────────

/** Walk up the tenant graph to the owning district (a `district`-type tenant). */
export function findDistrictForSchool(schoolTenantId: string): string | null {
  let cursor = getTenantById(schoolTenantId);
  const guard = new Set<string>();
  while (cursor && cursor.parentTenantId && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    const parent = getTenantById(cursor.parentTenantId);
    if (!parent) break;
    if (parent.type === "district") return parent.id;
    cursor = parent;
  }
  return null;
}

/** The seat cap + usage a given school currently sees from its district. */
export function getSchoolSeatView(schoolTenantId: string): {
  districtId: string | null;
  allocated: number;
  used: number;
} {
  const districtId = findDistrictForSchool(schoolTenantId);
  if (!districtId) return { districtId: null, allocated: 0, used: 0 };
  const st = ensureDistrict(districtId);
  const a = st.schools.get(schoolTenantId);
  return { districtId, allocated: a?.allocated ?? 0, used: a?.used ?? 0 };
}

export function createSeatRequest(input: {
  schoolId: string;
  requestedBy: string;
  requestedSeats: number;
  justification: string;
}): SeatRequestTicket {
  const view = getSchoolSeatView(input.schoolId);
  const ticket: SeatRequestTicket = {
    id: `seatreq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    schoolId: input.schoolId,
    districtId: view.districtId ?? "",
    requestedBy: input.requestedBy,
    currentSeats: view.allocated,
    requestedSeats: input.requestedSeats,
    justification: input.justification,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  seatRequests.set(ticket.id, ticket);
  return ticket;
}

export function listSeatRequestsForDistrict(districtId: string): SeatRequestTicket[] {
  return Array.from(seatRequests.values())
    .filter((r) => r.districtId === districtId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function listSeatRequestsForSchool(schoolId: string): SeatRequestTicket[] {
  return Array.from(seatRequests.values())
    .filter((r) => r.schoolId === schoolId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Platform rollup ──────────────────────────────────────────────────────────

export interface PlatformRollupRow {
  districtId: string;
  districtName: string;
  plan: string;
  status: string;
  seatsTotal: number;
  seatsAllocated: number;
  seatsUsed: number;
  utilizationPct: number;
  mrrCents: number;
  arrCents: number;
  churnRisk: "low" | "medium" | "high";
}

/** Cross-district rollup for the platform billing page. */
export function listPlatformRollup(districtIds: string[]): PlatformRollupRow[] {
  return districtIds.map((districtId) => {
    const st = ensureDistrict(districtId);
    const utilizationPct =
      st.pool.total === 0 ? 0 : Math.round((st.pool.used / st.pool.total) * 100);
    // Simple churn signal: low utilization or past-due status reads as risk.
    const churnRisk: PlatformRollupRow["churnRisk"] =
      st.pool.status === "past_due" || utilizationPct < 40
        ? "high"
        : utilizationPct < 65
          ? "medium"
          : "low";
    return {
      districtId,
      districtName: getTenantById(districtId)?.name ?? districtId,
      plan: st.pool.planId,
      status: st.pool.status,
      seatsTotal: st.pool.total,
      seatsAllocated: st.pool.allocated,
      seatsUsed: st.pool.used,
      utilizationPct,
      mrrCents: mrrCents(st.pool),
      arrCents: arrCents(st.pool),
      churnRisk,
    };
  });
}
