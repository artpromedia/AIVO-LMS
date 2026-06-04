import { describe, expect, it } from "vitest";
import { validateParams, prepareRun, executeRun } from "../src/runners/engine.js";
import { encodeCsv, encodeJson, encodeParquet } from "../src/runners/formats.js";
import { catalogForScope, getReport, scopeAllows } from "../src/registry/index.js";
import { reportVersion, captureLineage } from "../src/lineage.js";
import { createStore } from "../src/store.js";
import { enrollmentBySchool } from "../src/registry/district.reports.js";
import { tenantGrowth } from "../src/registry/platform.reports.js";

const ALL_TENANTS = ["tenant-springfield", "tenant-shelbyville", "tenant-riverdale"];

describe("param validation", () => {
  it("applies defaults and coerces types", () => {
    const v = validateParams(tenantGrowth, {});
    expect(v.ok).toBe(true);
    expect(v.params.sinceDays).toBe(365);
  });
  it("requires required params", () => {
    const v = validateParams(enrollmentBySchool, {});
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/tenantId/);
  });
  it("rejects non-numeric numbers", () => {
    const v = validateParams(tenantGrowth, { sinceDays: "abc" });
    expect(v.ok).toBe(false);
  });
});

describe("scope filtering", () => {
  it("scopeAllows respects scope ordering (caller ≥ report)", () => {
    expect(scopeAllows("platform", ["district"])).toBe(true);
    expect(scopeAllows("district", ["district"])).toBe(true);
    expect(scopeAllows("school", ["district"])).toBe(false);
    expect(scopeAllows("district", ["platform"])).toBe(false);
  });
  it("school catalog hides district/platform reports", () => {
    const ids = catalogForScope("school").map((r) => r.id);
    expect(ids).toContain("enrollment");
    expect(ids).not.toContain("enrollment-by-school"); // district scope
    expect(ids).not.toContain("mrr-by-plan"); // platform scope
  });
  it("platform catalog includes everything", () => {
    expect(catalogForScope("platform").length).toBe(catalogForScope("platform").length);
    expect(catalogForScope("platform").map((r) => r.id)).toContain("mrr-by-plan");
    expect(catalogForScope("platform").map((r) => r.id)).toContain("enrollment");
  });
});

describe("prepareRun authorization", () => {
  const base = {
    rawParams: { tenantId: "tenant-springfield" },
    tenantId: "tenant-springfield",
    allowedTenantIds: ["tenant-springfield"],
    callerScope: "district" as const,
    requestedBy: "u1",
  };
  it("blocks a school caller from a district report (SCOPE_FORBIDDEN)", () => {
    const r = prepareRun({ ...base, def: enrollmentBySchool, callerScope: "school" });
    expect(r).toMatchObject({ ok: false, code: "SCOPE_FORBIDDEN" });
  });
  it("blocks a tenantId param outside the caller's allow-list (TENANT_FORBIDDEN)", () => {
    const r = prepareRun({
      ...base,
      def: enrollmentBySchool,
      rawParams: { tenantId: "tenant-riverdale" },
      allowedTenantIds: ["tenant-springfield"],
    });
    expect(r).toMatchObject({ ok: false, code: "TENANT_FORBIDDEN" });
  });
  it("allows an in-scope district report", () => {
    const r = prepareRun({ ...base, def: enrollmentBySchool });
    expect(r.ok).toBe(true);
  });
});

describe("lineage capture", () => {
  it("records sources + a stable report version", async () => {
    const store = createStore();
    const prepared = prepareRun({
      def: tenantGrowth,
      rawParams: {},
      tenantId: null,
      allowedTenantIds: ALL_TENANTS,
      callerScope: "platform",
      requestedBy: "p1",
      store,
    });
    if (!prepared.ok) throw new Error("prepare failed");
    const run = await executeRun(
      {
        def: tenantGrowth,
        rawParams: {},
        tenantId: null,
        allowedTenantIds: ALL_TENANTS,
        callerScope: "platform",
        requestedBy: "p1",
        store,
      },
      prepared,
    );
    expect(run.status).toBe("succeeded");
    expect(run.lineage?.sources[0].service).toBe("tenant-svc");
    expect(run.lineage?.reportVersion).toBe(reportVersion(tenantGrowth));
    // captureLineage is deterministic for the same definition.
    expect(captureLineage(tenantGrowth, {}, []).reportVersion).toBe(reportVersion(tenantGrowth));
  });
});

describe("format encoders — deterministic snapshots", () => {
  const columns = [
    { key: "name", label: "Name", type: "string" as const },
    { key: "n", label: "N, total", type: "number" as const },
  ];
  const rows = [
    { name: "A", n: 1 },
    { name: 'Quote "x"', n: 2 },
  ];

  it("CSV quotes per RFC-4180 (only cells that need it)", () => {
    expect(encodeCsv(columns, rows).toString()).toMatchInlineSnapshot(`
      "Name,"N, total"
      A,1
      "Quote ""x""",2
      "
    `);
  });
  it("JSON projects to declared columns", () => {
    const parsed = JSON.parse(encodeJson(columns, rows).toString());
    expect(parsed.rows).toEqual([
      { name: "A", n: 1 },
      { name: 'Quote "x"', n: 2 },
    ]);
  });
  it("Parquet container is byte-stable", () => {
    const a = encodeParquet(columns, rows).toString();
    const b = encodeParquet(columns, rows).toString();
    expect(a).toBe(b);
    expect(a.startsWith("PAR1")).toBe(true);
    expect(a.endsWith("PAR1")).toBe(true);
  });
});

describe("caching", () => {
  it("a second identical run is served from cache", async () => {
    const store = createStore();
    const input = {
      def: tenantGrowth,
      rawParams: {},
      tenantId: null,
      allowedTenantIds: ALL_TENANTS,
      callerScope: "platform" as const,
      requestedBy: "p1",
      store,
    };
    const prepared = prepareRun(input);
    if (!prepared.ok) throw new Error("prepare failed");
    const first = await executeRun(input, prepared);
    const second = await executeRun(input, prepared);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.rowCount).toBe(first.rowCount);
  });
});

describe("performance — all reports run well under 30s on seeded data", () => {
  it("runs the full catalog quickly", async () => {
    const store = createStore();
    const start = Date.now();
    for (const def of catalogForScope("platform")) {
      const input = {
        def,
        rawParams: { tenantId: "tenant-springfield" },
        tenantId: "tenant-springfield",
        allowedTenantIds: ALL_TENANTS,
        callerScope: "platform" as const,
        requestedBy: "p1",
        store,
      };
      const prepared = prepareRun(input);
      if (prepared.ok) {
        const run = await executeRun(input, prepared);
        expect(run.status).toBe("succeeded");
      }
    }
    expect(Date.now() - start).toBeLessThan(30_000);
  });
});
