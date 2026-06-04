import { describe, expect, it, beforeEach } from "vitest";
import { buildApp } from "../src/index.js";
import { resetStatusStore } from "../src/statuspage/store.js";
import type { FastifyInstance } from "fastify";

const ADMIN = { "x-actor-role": "platform_admin" };

async function makeApp(): Promise<FastifyInstance> {
  resetStatusStore();
  return buildApp();
}

describe("status-page incident lifecycle + public summary", () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await makeApp();
  });

  it("declares an incident (platform only) and reflects it on the public page within the request", async () => {
    const denied = await app.inject({
      method: "POST",
      url: "/api/statuspage/incidents",
      payload: { title: "DB outage", impact: "critical", affectedComponentIds: ["comp-billing"] },
      headers: { "x-actor-role": "district_admin" },
    });
    expect(denied.statusCode).toBe(403);

    const created = await app.inject({
      method: "POST",
      url: "/api/statuspage/incidents",
      payload: { title: "DB outage", impact: "critical", affectedComponentIds: ["comp-billing"] },
      headers: ADMIN,
    });
    expect(created.statusCode).toBe(201);
    const { incident } = created.json();
    expect(incident.lifecycle).toBe("investigating");

    const summary = await app.inject({ method: "GET", url: "/api/statuspage/public/summary" });
    const body = summary.json();
    expect(body.activeIncidents.some((i: any) => i.id === incident.id)).toBe(true);
    // Affected component degraded → overall not operational.
    expect(body.overall).not.toBe("operational");
    const billing = body.components.find((c: any) => c.id === "comp-billing");
    expect(billing.status).not.toBe("operational");
  });

  it("walks investigating → identified → monitoring → resolved and appends updates", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/statuspage/incidents",
      payload: { title: "Latency", impact: "minor", affectedComponentIds: ["comp-tutor"] },
      headers: ADMIN,
    });
    const id = created.json().incident.id;

    for (const lifecycle of ["identified", "monitoring", "resolved"]) {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/statuspage/incidents/${id}`,
        payload: { lifecycle, message: `now ${lifecycle}` },
        headers: ADMIN,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().incident.lifecycle).toBe(lifecycle);
    }

    const detail = await app.inject({ method: "GET", url: `/api/statuspage/incidents/${id}` });
    const { incident, updates } = detail.json();
    expect(incident.lifecycle).toBe("resolved");
    expect(incident.resolvedAt).not.toBeNull();
    // opening update + 3 transitions = 4
    expect(updates.length).toBe(4);
    expect(updates.map((u: any) => u.lifecycle)).toEqual([
      "investigating",
      "identified",
      "monitoring",
      "resolved",
    ]);

    // Resolved → component restored, no longer in active incidents.
    const summary = (
      await app.inject({ method: "GET", url: "/api/statuspage/public/summary" })
    ).json();
    expect(summary.activeIncidents.some((i: any) => i.id === id)).toBe(false);
    const tutor = summary.components.find((c: any) => c.id === "comp-tutor");
    expect(tutor.status).toBe("operational");
  });

  it("scopes the public summary by tenant", async () => {
    // comp-assessment is only visible/affecting tenant-springfield.
    const scoped = (
      await app.inject({
        method: "GET",
        url: "/api/statuspage/public/summary?tenantId=tenant-other",
      })
    ).json();
    expect(scoped.components.some((c: any) => c.id === "comp-assessment")).toBe(false);

    const springfield = (
      await app.inject({
        method: "GET",
        url: "/api/statuspage/public/summary?tenantId=tenant-springfield",
      })
    ).json();
    expect(springfield.components.some((c: any) => c.id === "comp-assessment")).toBe(true);
  });

  it("schedules maintenance (platform only) and flips component to under_maintenance when in progress", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/statuspage/maintenances",
      payload: {
        title: "Upgrade",
        componentIds: ["comp-identity"],
        scheduledStart: new Date(Date.now() + 3600_000).toISOString(),
        scheduledEnd: new Date(Date.now() + 7200_000).toISOString(),
      },
      headers: ADMIN,
    });
    expect(created.statusCode).toBe(201);
    const mId = created.json().maintenance.id;

    await app.inject({
      method: "PATCH",
      url: `/api/statuspage/maintenances/${mId}`,
      payload: { state: "in_progress" },
      headers: ADMIN,
    });
    const components = (
      await app.inject({ method: "GET", url: "/api/statuspage/components" })
    ).json();
    const identity = components.components.find((c: any) => c.id === "comp-identity");
    expect(identity.status).toBe("under_maintenance");
  });
});
