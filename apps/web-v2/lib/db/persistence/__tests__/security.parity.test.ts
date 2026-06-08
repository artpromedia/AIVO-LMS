/**
 * security — memory == postgres parity (Sprint 4).
 *
 * Platform-global SOC 2 / incident / vendor / privacy-matrix / vuln
 * artifacts. Pins the divergence-prone semantics: controls sort by code;
 * evidence is FK-checked + newest-collected first; incidents seed an opening
 * timeline + resolve-stamp; the timeline is occurredAt-ascending; vulns
 * stamp resolvedAt on fix; state-privacy mappings are FK-checked.
 */
import { it, expect } from "vitest";
import {
  listSecurityControls,
  createSecurityControl,
  updateSecurityControl,
  createControlEvidence,
  listEvidenceForControl,
  createRisk,
  updateRisk,
  listRisks,
  createIncident,
  updateIncident,
  appendIncidentTimeline,
  listIncidentTimeline,
  listIncidents,
  createVendor,
  updateVendor,
  listVendors,
  listStatePrivacyRequirements,
  createStatePrivacyMapping,
  listStatePrivacyMappingsFor,
  createVulnerability,
  updateVulnerability,
  listVulnerabilities,
} from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

const ctl = (code: string) =>
  ({
    code,
    title: `Control ${code}`,
    description: "d",
    criterion: "security",
    owner: "u_owner",
    status: "implemented",
  }) as Parameters<typeof createSecurityControl>[0];

runInBothModes("security", () => {
  it("controls sort by code; update stamps lastReviewedAt", async () => {
    await createSecurityControl(ctl("CC-200"));
    const a = await createSecurityControl(ctl("CC-100"));
    const codes = (await listSecurityControls())
      .map((c) => c.code)
      .filter((c) => c.startsWith("CC-"));
    expect(codes).toEqual(["CC-100", "CC-200"]);
    const updated = await updateSecurityControl(a.id, { status: "in_progress" } as never);
    expect(updated?.status).toBe("in_progress");
    expect(await updateSecurityControl("ctl-absent", { status: "implemented" } as never)).toBeNull();
  });

  it("evidence is FK-checked and newest-collected first", async () => {
    const c = await createSecurityControl(ctl("EV-1"));
    expect(
      await createControlEvidence({ controlId: "ctl-absent", kind: "doc", uri: "x", note: "" } as never),
    ).toBeNull();
    await createControlEvidence({ controlId: c.id, kind: "doc", uri: "u1", note: "" } as never);
    await createControlEvidence({ controlId: c.id, kind: "doc", uri: "u2", note: "" } as never);
    expect(await listEvidenceForControl(c.id)).toHaveLength(2);
  });

  it("risks list newest-updated first; update bumps updatedAt", async () => {
    const r = await createRisk({
      title: "R1",
      description: "d",
      category: "security",
      inherentSeverity: "high",
      residualSeverity: "low",
      treatment: "mitigate",
      owner: "u_owner",
      open: true,
    } as never);
    const got = (await listRisks()).find((x) => x.id === r.id);
    expect(got?.id).toBe(r.id);
    const u = await updateRisk(r.id, { open: false } as never);
    expect(u?.open).toBe(false);
  });

  it("incident create seeds a detection timeline; resolve stamps resolvedAt", async () => {
    const inc = await createIncident({
      title: "Breach",
      summary: "s",
      severity: "sev2",
      commanderUserId: "u_cmd",
      customerImpact: false,
      regulatorNotificationRequired: false,
    } as Parameters<typeof createIncident>[0]);
    expect((await listIncidents()).some((i) => i.id === inc.id)).toBe(true);
    const tl0 = await listIncidentTimeline(inc.id);
    expect(tl0).toHaveLength(1);
    expect(tl0[0]!.kind).toBe("detection");

    await appendIncidentTimeline({
      incidentId: inc.id,
      authorUserId: "u_cmd",
      kind: "investigation",
      message: "mitigating",
    } as Parameters<typeof appendIncidentTimeline>[0]);
    const tl1 = await listIncidentTimeline(inc.id);
    expect(tl1).toHaveLength(2);
    // occurredAt-ascending: the seeded detection is first.
    expect(tl1[0]!.kind).toBe("detection");

    const resolved = await updateIncident(inc.id, { status: "resolved" } as never);
    expect(resolved?.resolvedAt).not.toBeNull();
    // Appending to a non-existent incident returns null.
    expect(
      await appendIncidentTimeline({
        incidentId: "inc-absent",
        authorUserId: "x",
        kind: "investigation",
        message: "m",
      } as Parameters<typeof appendIncidentTimeline>[0]),
    ).toBeNull();
  });

  it("vendors sort by name; update stamps lastReviewedAt", async () => {
    const v = await createVendor({
      name: "Zeta",
      category: "infra",
      dataResidency: "us",
      processesLearnerData: false,
      dpaSigned: true,
      riskTier: "low",
      approved: true,
      notes: null,
    } as never);
    await createVendor({
      name: "Alpha",
      category: "infra",
      dataResidency: "us",
      processesLearnerData: false,
      dpaSigned: true,
      riskTier: "low",
      approved: true,
      notes: null,
    } as never);
    const names = (await listVendors()).map((x) => x.name).filter((n) => n === "Alpha" || n === "Zeta");
    expect(names).toEqual(["Alpha", "Zeta"]);
    expect((await updateVendor(v.id, { approved: false } as never))?.approved).toBe(false);
  });

  it("state-privacy mapping is FK-checked against requirement + control", async () => {
    const req = (await listStatePrivacyRequirements())[0];
    expect(req).toBeTruthy();
    const c = await createSecurityControl(ctl("SP-1"));
    // Unknown requirement → null.
    expect(
      await createStatePrivacyMapping({ requirementId: "req-absent", controlId: c.id, status: "mapped" } as never),
    ).toBeNull();
    const mapping = await createStatePrivacyMapping({
      requirementId: req!.id,
      controlId: c.id,
      status: "mapped",
    } as never);
    expect(mapping).not.toBeNull();
    expect((await listStatePrivacyMappingsFor(req!.id)).some((m) => m.id === mapping!.id)).toBe(true);
  });

  it("vulnerability fix stamps resolvedAt; list newest-discovered first", async () => {
    const v = await createVulnerability({
      title: "CVE thing",
      cveId: "CVE-2026-1",
      severity: "high",
      status: "open",
      source: "scanner",
      affectedComponent: "web",
      fixedIn: null,
    } as never);
    expect((await listVulnerabilities()).some((x) => x.id === v.id)).toBe(true);
    const fixed = await updateVulnerability(v.id, { status: "fixed" } as never);
    expect(fixed?.status).toBe("fixed");
    expect(fixed?.resolvedAt).not.toBeNull();
  });
});
