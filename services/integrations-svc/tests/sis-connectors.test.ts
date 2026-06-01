/**
 * Sprint 4 (production readiness) — Schoology + PowerSchool roster sync.
 *
 * These were `coming_soon` stubs. The sync handlers now pull users / staff /
 * sections and map them into roster mappings. Tests use a fake fetch + a
 * capturing fake db, so they exercise the request shaping and the mapping
 * logic without touching a real vendor API or Postgres.
 */
import { describe, it, expect } from "vitest";
import { syncSchoology, syncPowerSchool } from "../src/routes/connectors.js";

/** Capturing fake db: records every roster-mapping insert. */
function fakeDb() {
  const inserts: any[] = [];
  return {
    inserts,
    insert() {
      return {
        values(v: any) {
          return {
            onConflictDoNothing() {
              inserts.push(v);
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
}

function jsonResponse(body: any, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

const connection = { id: "conn-1", config: {} };

describe("syncSchoology", () => {
  it("maps students, teachers, and sections into roster mappings", async () => {
    const db = fakeDb();
    const calls: string[] = [];
    const fetchImpl = (url: string) => {
      calls.push(url);
      if (url.includes("/users")) {
        return jsonResponse({
          teacher_role_id: 2,
          user: [
            { uid: 10, role_id: 1, name_display: "Sam Student", primary_email: "sam@s.edu" },
            { uid: 11, role_id: 2, name_display: "Tina Teacher", primary_email: "tina@s.edu" },
          ],
        });
      }
      if (url.includes("/sections")) {
        return jsonResponse({ section: [{ id: 99, section_title: "Math 1" }] });
      }
      return jsonResponse({}, false, 404);
    };

    const res = await syncSchoology(db, connection, { accessToken: "tok" }, fetchImpl);

    expect(res.synced).toBe(3);
    expect(res.failed).toBe(0);
    expect(calls[0]).toContain("https://api.schoology.com/v1/users");
    const types = db.inserts.map((i) => `${i.externalType}:${i.aivoType}`);
    expect(types).toContain("student:learner");
    expect(types).toContain("teacher:teacher");
    expect(types).toContain("section:class");
  });

  it("reports an error and no syncs when auth fails", async () => {
    const db = fakeDb();
    const res = await syncSchoology(db, connection, { accessToken: "tok" }, () =>
      jsonResponse({}, false, 401),
    );
    expect(res.synced).toBe(0);
    expect(res.errors[0].message).toMatch(/users fetch failed: 401/);
  });

  it("errors when no access token is present", async () => {
    const res = await syncSchoology(fakeDb(), connection, {}, () => jsonResponse({}));
    expect(res.errors[0].message).toMatch(/access token missing/);
  });
});

describe("syncPowerSchool", () => {
  const psConn = { id: "conn-2", config: { powerschoolUrl: "https://ps.district.org/" } };

  it("maps students, staff, and sections from /ws/v1 resources", async () => {
    const db = fakeDb();
    const calls: string[] = [];
    const fetchImpl = (url: string) => {
      calls.push(url);
      if (url.includes("/student")) {
        return jsonResponse({
          students: {
            student: [
              {
                id: 500,
                local_id: "S500",
                name: { first_name: "Pat", last_name: "Pupil" },
                school_enrollment: { grade_level: 4, school_number: 7 },
              },
            ],
          },
        });
      }
      if (url.includes("/staff")) {
        return jsonResponse({
          staffs: { staff: { id: 800, name: { first_name: "Ed", last_name: "Educator" } } },
        });
      }
      if (url.includes("/section")) {
        return jsonResponse({ sections: { section: [{ id: 900, section_number: "4A" }] } });
      }
      return jsonResponse({}, false, 404);
    };

    const res = await syncPowerSchool(db, psConn, { accessToken: "tok" }, fetchImpl);

    expect(res.synced).toBe(3); // 1 student + 1 staff (single-object) + 1 section
    expect(calls[0]).toContain("https://ps.district.org/ws/v1/district/student");
    const student = db.inserts.find((i) => i.externalType === "student");
    expect(student.externalData.name).toBe("Pat Pupil");
    expect(student.externalData.gradeLevel).toBe(4);
    expect(db.inserts.some((i) => i.externalType === "teacher")).toBe(true);
    expect(db.inserts.some((i) => i.externalType === "section")).toBe(true);
  });

  it("errors when the server URL is not configured", async () => {
    const res = await syncPowerSchool(fakeDb(), { id: "c", config: {} }, { accessToken: "t" }, () =>
      jsonResponse({}),
    );
    expect(res.errors[0].message).toMatch(/server URL not configured/);
  });
});
