/**
 * Wire-level e2e for the Schoology + PowerSchool roster sync.
 *
 * Unlike sis-connectors.test.ts (which injects a fake fetch), this stands up a
 * real Fastify "vendor" HTTP server and drives the sync handlers through the
 * platform's actual `fetch` — validating URL construction, auth headers,
 * pagination params, and JSON parsing over the wire. This is the closest
 * automated approximation of a vendor-sandbox run; the credentialed live test
 * lives in sis-connectors.live.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { syncSchoology, syncPowerSchool } from "../src/routes/connectors.js";

/** Capturing fake db (the sync handlers only ever insert roster mappings). */
function fakeDb() {
  const inserts: any[] = [];
  return {
    inserts,
    insert: () => ({
      values: (v: any) => ({
        onConflictDoNothing: () => {
          inserts.push(v);
          return Promise.resolve();
        },
      }),
    }),
  };
}

let vendor: FastifyInstance;
let baseUrl: string;
const seen: Array<{ url: string; auth?: string }> = [];

beforeAll(async () => {
  vendor = Fastify();

  // --- Schoology surface ---
  vendor.get("/schoology/v1/users", async (req) => {
    seen.push({ url: req.url, auth: req.headers.authorization });
    return {
      teacher_role_id: 2,
      user: [
        { uid: 10, role_id: 1, name_display: "Sam Student", primary_email: "sam@s.edu" },
        { uid: 11, role_id: 2, name_display: "Tina Teacher", primary_email: "tina@s.edu" },
      ],
    };
  });
  vendor.get("/schoology/v1/sections", async () => ({
    section: [{ id: 99, section_title: "Math 1", course_title: "Mathematics" }],
  }));

  // --- PowerSchool surface ---
  vendor.get("/ws/v1/district/student", async (req) => {
    seen.push({ url: req.url, auth: req.headers.authorization });
    return {
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
    };
  });
  vendor.get("/ws/v1/district/staff", async () => ({
    staffs: { staff: [{ id: 800, name: { first_name: "Ed", last_name: "Educator" } }] },
  }));
  vendor.get("/ws/v1/district/section", async () => ({
    sections: { section: [{ id: 900, section_number: "4A", course_id: "C1" }] },
  }));

  await vendor.listen({ port: 0, host: "127.0.0.1" });
  const addr = vendor.server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await vendor.close();
});

describe("Schoology roster sync (over real HTTP)", () => {
  it("authenticates and maps users + sections from the live wire", async () => {
    const db = fakeDb();
    const connection = {
      id: "conn-schoology",
      config: { schoologyApiBase: `${baseUrl}/schoology/v1` },
    };
    const res = await syncSchoology(db, connection, { accessToken: "tok-123" });

    expect(res.errors).toHaveLength(0);
    expect(res.synced).toBe(3);
    // Auth header actually reached the server over the wire.
    const usersCall = seen.find((s) => s.url.startsWith("/schoology/v1/users"));
    expect(usersCall?.auth).toBe("Bearer tok-123");
    const types = db.inserts.map((i) => `${i.externalType}:${i.aivoType}`);
    expect(types).toEqual(
      expect.arrayContaining(["student:learner", "teacher:teacher", "section:class"]),
    );
  });
});

describe("PowerSchool roster sync (over real HTTP)", () => {
  it("authenticates and maps students/staff/sections from the live wire", async () => {
    const db = fakeDb();
    const connection = { id: "conn-ps", config: { powerschoolUrl: baseUrl } };
    const res = await syncPowerSchool(db, connection, { accessToken: "ps-tok" });

    expect(res.errors).toHaveLength(0);
    expect(res.synced).toBe(3);
    const studentCall = seen.find((s) => s.url.startsWith("/ws/v1/district/student"));
    expect(studentCall?.auth).toBe("Bearer ps-tok");
    expect(studentCall?.url).toContain("pagesize=200");
    const student = db.inserts.find((i) => i.externalType === "student");
    expect(student.externalData.name).toBe("Pat Pupil");
  });
});
