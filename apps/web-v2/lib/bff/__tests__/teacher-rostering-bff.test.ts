/**
 * Teacher rostering BFF — RBAC + tenant scoping.
 *
 * The route handlers live under `app/` (which vitest does not collect),
 * so this lib-level test imports them via the `@/app/...` alias. The
 * session/auth layer and the audit sink are mocked; the in-memory
 * `sis-store` runs for real against a fresh seed.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const SEED_TENANT = "t_district_demo"; // matches sis-store seed
const SEED_CONNECTOR = "sis_demo_oneroster";

let currentSession: SessionProfile | null = null;

function asSession(partial: Partial<SessionProfile>): SessionProfile {
  return {
    userId: "u_test",
    tenantId: SEED_TENANT,
    role: "teacher",
    email: "t@demo.aivo",
    displayName: "Teacher",
    permissions: [],
    ...partial,
  } as SessionProfile;
}

vi.mock("@/lib/auth/mock-session", () => ({
  readMockSessionFromCookies: vi.fn(async () => currentSession),
}));
vi.mock("@/lib/db/repos", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

import { GET, POST } from "@/app/api/bff/teacher/rostering/route";
import { POST as SYNC } from "@/app/api/bff/teacher/rostering/[connectorId]/sync/route";
import { _resetSisStore } from "@/lib/db/sis-store";

function req(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/bff/teacher/rostering", {
    method,
    headers: { "content-type": "application/json", "x-request-id": "req_test" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("teacher rostering BFF", () => {
  beforeEach(() => {
    _resetSisStore();
    currentSession = null;
  });

  it("rejects unauthenticated callers", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(401);
  });

  it("forbids non-rostering roles (learner)", async () => {
    currentSession = asSession({ role: "learner" });
    const res = await GET(req("GET"));
    expect(res.status).toBe(403);
  });

  it("lists only the teacher's own tenant connectors", async () => {
    currentSession = asSession({ tenantId: SEED_TENANT });
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { connectors: Array<{ tenantId: string }> };
    };
    expect(json.data.connectors.length).toBeGreaterThan(0);
    expect(json.data.connectors.every((c) => c.tenantId === SEED_TENANT)).toBe(true);
  });

  it("returns nothing for a teacher in a different tenant", async () => {
    currentSession = asSession({ tenantId: "t_other_school" });
    const res = await GET(req("GET"));
    const json = (await res.json()) as { data: { connectors: unknown[] } };
    expect(json.data.connectors).toHaveLength(0);
  });

  it("lets a teacher connect a Google Classroom roster in their own tenant", async () => {
    currentSession = asSession({ tenantId: "t_my_school" });
    const res = await POST(req("POST", { provider: "google_classroom", displayName: "Room 12" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { connector: { tenantId: string; provider: string } };
    };
    expect(json.data.connector.tenantId).toBe("t_my_school");
    expect(json.data.connector.provider).toBe("google_classroom");
  });

  it("blocks syncing a connector owned by another tenant", async () => {
    currentSession = asSession({ tenantId: "t_other_school" });
    const res = await SYNC(
      new Request(`http://localhost/api/bff/teacher/rostering/${SEED_CONNECTOR}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "full" }),
      }),
      { params: Promise.resolve({ connectorId: SEED_CONNECTOR }) },
    );
    expect(res.status).toBe(403);
  });
});
