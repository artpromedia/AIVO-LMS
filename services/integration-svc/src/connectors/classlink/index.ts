/**
 * Sprint 2 — ClassLink Roster Server connector.
 *
 * ClassLink's Roster Server exposes a OneRoster 1.1 REST API with OAuth2
 * `client_credentials`, so this connector is a thin configuration wrapper
 * over the shared OneRoster REST connector — the snapshot it returns is
 * re-tagged with `provider: "classlink"` so the mapping table and audit
 * trail attribute records correctly.
 */
import { extractOneRosterRest, type OneRosterRestConfig } from "../oneroster/rest.js";
import type { RosterSnapshot } from "../../types/canonical.js";

export interface ClassLinkConfig {
  /** Roster Server base, e.g. https://oneroster.classlink.com/ims/oneroster/v1p1 */
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  pageSize?: number;
}

function retag(snap: RosterSnapshot): RosterSnapshot {
  const fix = <T extends { provider: unknown }>(arr: T[]) =>
    arr.map((x) => ({ ...x, provider: "classlink" as const }));
  return {
    provider: "classlink",
    orgs: fix(snap.orgs),
    users: fix(snap.users),
    courses: fix(snap.courses),
    terms: fix(snap.terms),
    classes: fix(snap.classes),
    enrollments: fix(snap.enrollments),
    demographics: snap.demographics
      ? snap.demographics.map((d) => ({ ...d, provider: "classlink" as const }))
      : [],
  };
}

export async function extractClassLink(
  cfg: ClassLinkConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<RosterSnapshot> {
  const orCfg: OneRosterRestConfig = { ...cfg };
  const snap = await extractOneRosterRest(orCfg, fetchImpl);
  return retag(snap);
}
