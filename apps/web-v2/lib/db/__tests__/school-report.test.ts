/**
 * Sprint 8 — school report + CSV export tests.
 *
 * Pins down the shape the BFF route serialises:
 *   - per-learner rows with IEP / consent / lesson counts
 *   - summary aggregates (totals, coverage %)
 *   - CSV: RFC 4180-safe (commas / quotes / newlines escaped) and
 *     header consistent across releases
 *
 * Class CRUD repo helpers (createClassroom / deleteClassroom) are
 * tested here too — they back the /api/bff/admin/school/classes route.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore, getStore } from "@/lib/db/store";
import {
  addStaffUser,
  createClassroom,
  deleteClassroom,
  getSchoolReport,
  listClassrooms,
  removeStaffUser,
  renderSchoolReportCsv,
} from "@/lib/db/repos";

describe("getSchoolReport", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("returns a summary + per-learner rows for the seeded tenant", async () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const report = await getSchoolReport(tenant.id);
    expect(report.summary.totalLearners).toBeGreaterThanOrEqual(0);
    expect(report.summary.iepCoveragePct).toBeGreaterThanOrEqual(0);
    expect(report.summary.iepCoveragePct).toBeLessThanOrEqual(100);
    expect(report.summary.consentCoveragePct).toBeGreaterThanOrEqual(0);
    expect(report.summary.consentCoveragePct).toBeLessThanOrEqual(100);
    expect(Array.isArray(report.rows)).toBe(true);
    if (report.rows.length > 0) {
      const row = report.rows[0];
      expect(typeof row.learnerName).toBe("string");
      expect(typeof row.iepOnFile).toBe("boolean");
      expect(typeof row.lessonsCompleted).toBe("number");
    }
  });

  it("respects a custom date range for lessonsInWindow", async () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date().toISOString();
    const wide = await getSchoolReport(tenant.id, { startIso: start, endIso: end });
    const narrow = await getSchoolReport(tenant.id, {
      startIso: new Date(Date.now() - 60 * 1000).toISOString(),
      endIso: end,
    });
    // Wider window must include at least as many lessons.
    expect(wide.summary.lessonsInWindow).toBeGreaterThanOrEqual(narrow.summary.lessonsInWindow);
  });
});

describe("renderSchoolReportCsv", () => {
  it("emits a stable header and RFC-4180-safe rows", async () => {
    const tenant = Array.from(getStore().tenants.values())[0] ?? null;
    if (!tenant) {
      resetStore();
      ensureSeeded();
    }
    const t = Array.from(getStore().tenants.values())[0]!;
    const report = await getSchoolReport(t.id);
    const csv = renderSchoolReportCsv(report);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe(
      [
        "learnerId",
        "learnerName",
        "classroomName",
        "gradeBand",
        "iepOnFile",
        "baselineCompleted",
        "lessonsCompleted",
        "lessonsInWindow",
        "consentOnFile",
        "lastActiveIso",
      ].join(","),
    );
  });

  it("quotes values containing commas / quotes / newlines", () => {
    const csv = renderSchoolReportCsv({
      summary: {
        totalLearners: 1,
        lessonsInWindow: 0,
        iepCoveragePct: 0,
        consentCoveragePct: 0,
        windowStartIso: "2026-01-01T00:00:00Z",
        windowEndIso: "2026-02-01T00:00:00Z",
      },
      rows: [
        {
          learnerId: "lr-1",
          learnerName: 'Smith, "Jane"',
          classroomName: "Class A\nB",
          gradeBand: "3",
          iepOnFile: true,
          baselineCompleted: false,
          lessonsCompleted: 4,
          lessonsInWindow: 1,
          consentOnFile: true,
          lastActiveIso: null,
        },
      ],
    });
    // Embedded newline means we can't split by \n — assert against the
    // whole CSV body instead.
    expect(csv).toContain('"Smith, ""Jane"""');
    expect(csv).toContain('"Class A\nB"');
  });
});

describe("class CRUD repo helpers", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("createClassroom + deleteClassroom round trip", async () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const before = (await listClassrooms({ tenantId: tenant.id })).length;
    const created = await createClassroom({
      tenantId: tenant.id,
      schoolId: "school-1",
      name: "Test Room",
      gradeBand: "3" as never,
      teacherUserId: "user-1",
      courseId: null,
    });
    expect((await listClassrooms({ tenantId: tenant.id })).length).toBe(before + 1);
    const removed = await deleteClassroom(created.id, tenant.id);
    expect(removed).toBe(true);
    expect((await listClassrooms({ tenantId: tenant.id })).length).toBe(before);
  });

  it("deleteClassroom returns false for an unknown id", async () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    expect(await deleteClassroom("nonexistent", tenant.id)).toBe(false);
  });
});

describe("staff add / remove repo helpers", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("addStaffUser inserts a user with INVITED status", async () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const user = await addStaffUser({
      tenantId: tenant.id,
      email: "new.teacher@example.com",
      displayName: "Avery Teacher",
      role: "TEACHER",
    });
    expect(user.email).toBe("new.teacher@example.com");
    expect((user as { status?: string }).status).toBe("INVITED");
  });

  it("removeStaffUser returns false for a foreign tenant", async () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const user = await addStaffUser({
      tenantId: tenant.id,
      email: "x@example.com",
      displayName: "X",
      role: "TEACHER",
    });
    expect(await removeStaffUser(user.id, "other-tenant")).toBe(false);
    expect(await removeStaffUser(user.id, tenant.id)).toBe(true);
    expect(await removeStaffUser(user.id, tenant.id)).toBe(false); // already gone
  });
});
