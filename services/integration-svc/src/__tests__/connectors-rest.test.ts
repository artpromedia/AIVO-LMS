import { describe, it, expect, vi } from "vitest";
import {
  getAccessToken,
  fetchAll,
  mapUser,
  mapClass,
  extractOneRosterRest,
  type OneRosterRestConfig,
} from "../connectors/oneroster/rest.js";
import { extractClassLink } from "../connectors/classlink/index.js";
import {
  mapCleverUser,
  mapCleverSection,
  mapCleverSchool,
  extractClever,
} from "../connectors/clever/index.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const cfg: OneRosterRestConfig = {
  baseUrl: "https://sis.example.com/ims/oneroster/v1p2",
  tokenUrl: "https://sis.example.com/token",
  clientId: "id",
  clientSecret: "secret",
  pageSize: 2,
};

describe("OneRoster REST connector", () => {
  it("exchanges client_credentials for a bearer token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: "tok-123" }));
    const token = await getAccessToken(cfg, fetchImpl as unknown as typeof fetch);
    expect(token).toBe("tok-123");
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toMatch(/^Basic /);
  });

  it("pages through a collection until a short page", async () => {
    const pages = [
      { orgs: [{ sourcedId: "a" }, { sourcedId: "b" }] },
      { orgs: [{ sourcedId: "c" }] },
    ];
    let call = 0;
    const fetchImpl = vi.fn(async () => jsonResponse(pages[call++]));
    const all = await fetchAll(cfg, "tok", "/orgs", "orgs", fetchImpl as unknown as typeof fetch);
    expect(all.map((o) => o.sourcedId)).toEqual(["a", "b", "c"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps a 1.2 user with roles[] and GUIDRef orgs", () => {
    const u = mapUser({
      sourcedId: "u1",
      status: "active",
      enabledUser: true,
      givenName: "Ann",
      familyName: "Lee",
      roles: [{ role: "teacher" }],
      orgs: [{ sourcedId: "sch-1" }],
    });
    expect(u.primaryRole).toBe("teacher");
    expect(u.orgSourcedIds).toEqual(["sch-1"]);
  });

  it("maps a class with school + term GUIDRefs", () => {
    const c = mapClass({
      sourcedId: "c1",
      title: "Math",
      classType: "scheduled",
      school: { sourcedId: "sch-1" },
      terms: [{ sourcedId: "t1" }],
    });
    expect(c.schoolSourcedId).toBe("sch-1");
    expect(c.termSourcedIds).toEqual(["t1"]);
  });

  it("extracts a full snapshot across endpoints", async () => {
    const byPath: Record<string, unknown> = {
      token: { access_token: "tok" },
      "/orgs": { orgs: [{ sourcedId: "o1", name: "D", type: "district" }] },
      "/academicSessions": { academicSessions: [{ sourcedId: "t1", title: "T", type: "term" }] },
      "/courses": { courses: [{ sourcedId: "co1", title: "C" }] },
      "/classes": { classes: [{ sourcedId: "cl1", title: "Cl", school: { sourcedId: "o1" } }] },
      "/users": { users: [{ sourcedId: "u1", givenName: "A", familyName: "B", role: "student" }] },
      "/enrollments": {
        enrollments: [
          {
            sourcedId: "e1",
            class: { sourcedId: "cl1" },
            user: { sourcedId: "u1" },
            school: { sourcedId: "o1" },
            role: "student",
          },
        ],
      },
    };
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/token")) return jsonResponse(byPath.token);
      const key = Object.keys(byPath).find((k) => k.startsWith("/") && url.includes(k));
      return jsonResponse(byPath[key!]);
    });
    const snap = await extractOneRosterRest(cfg, fetchImpl as unknown as typeof fetch);
    expect(snap.orgs).toHaveLength(1);
    expect(snap.enrollments[0].classSourcedId).toBe("cl1");
  });
});

describe("ClassLink connector (OneRoster wrapper)", () => {
  it("retags the snapshot provider as classlink", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/token")) return jsonResponse({ access_token: "t" });
      if (url.includes("/orgs"))
        return jsonResponse({ orgs: [{ sourcedId: "o1", name: "D", type: "district" }] });
      return jsonResponse({ [Object.keys({})[0] ?? "x"]: [] });
    });
    const snap = await extractClassLink(
      {
        baseUrl: "https://cl/v1p1",
        tokenUrl: "https://cl/token",
        clientId: "i",
        clientSecret: "s",
        pageSize: 100,
      },
      fetchImpl as unknown as typeof fetch,
    );
    expect(snap.provider).toBe("classlink");
    expect(snap.orgs[0].provider).toBe("classlink");
  });
});

describe("Clever connector", () => {
  it("maps a user's role map to canonical roles", () => {
    const u = mapCleverUser({
      id: "u1",
      name: { first: "A", last: "B" },
      roles: { teacher: {} },
      school: "sch-1",
    });
    expect(u.primaryRole).toBe("teacher");
    expect(u.orgSourcedIds).toEqual(["sch-1"]);
  });

  it("expands a section into a class plus teacher/student enrollments", () => {
    const { cls, enrollments } = mapCleverSection({
      id: "sec-1",
      name: "Math A",
      school: "sch-1",
      teacher: "t1",
      students: ["s1", "s2"],
      course: "crs-1",
      term: "term-1",
    });
    expect(cls.schoolSourcedId).toBe("sch-1");
    expect(enrollments).toHaveLength(3);
    expect(enrollments.filter((e) => e.role === "student")).toHaveLength(2);
    expect(enrollments.find((e) => e.role === "teacher")!.primary).toBe(true);
  });

  it("maps a school", () => {
    expect(mapCleverSchool({ id: "s1", name: "Elm", nces_id: "N1" }).type).toBe("school");
  });

  it("extracts a snapshot with paged cursors", async () => {
    const data = {
      "/v3.0/schools": [{ data: { id: "sch-1", name: "Elm" } }],
      "/v3.0/terms": [],
      "/v3.0/courses": [],
      "/v3.0/users": [
        {
          data: {
            id: "u1",
            name: { first: "A", last: "B" },
            roles: { student: {} },
            school: "sch-1",
          },
        },
      ],
      "/v3.0/sections": [
        { data: { id: "sec-1", name: "M", school: "sch-1", teacher: "t1", students: ["u1"] } },
      ],
    } as Record<string, unknown>;
    const fetchImpl = vi.fn(async (url: string) => {
      const key = Object.keys(data).find((k) => url.includes(k))!;
      return jsonResponse({ data: data[key] });
    });
    const snap = await extractClever(
      { token: "tok", pageSize: 1000 },
      fetchImpl as unknown as typeof fetch,
    );
    expect(snap.orgs).toHaveLength(1);
    expect(snap.classes).toHaveLength(1);
    expect(snap.enrollments.length).toBeGreaterThan(0);
  });
});
