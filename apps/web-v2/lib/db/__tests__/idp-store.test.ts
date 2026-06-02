/**
 * Sprint 1 (Enterprise Identity) — per-tenant IdP config store tests.
 *
 * Covers upsert create/update semantics, attribute-mapping merge, and the
 * SCIM token lifecycle (issue returns plaintext once + preview; revoke).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetIdpStore,
  upsertIdpConfig,
  getIdpConfig,
  getIdpConfigByTenant,
  listIdpConfigs,
  deleteIdpConfig,
  issueScimToken,
  revokeScimToken,
  listActiveScimTokens,
  defaultAttributeMapping,
} from "@/lib/db/idp-store";

describe("idp-store", () => {
  beforeEach(() => _resetIdpStore());

  it("creates a config with defaults and finds it by tenant", () => {
    const rec = upsertIdpConfig({ tenantId: "t1", protocol: "saml", idpLabel: "Okta" });
    expect(rec.id).toMatch(/^idp_/);
    expect(rec.enabled).toBe(false);
    expect(rec.jitProvisioning).toBe(true);
    expect(rec.attributeMapping).toEqual(defaultAttributeMapping());
    expect(getIdpConfigByTenant("t1")?.id).toBe(rec.id);
    expect(getIdpConfig(rec.id)?.idpLabel).toBe("Okta");
  });

  it("updates the existing tenant config rather than creating a duplicate", () => {
    const a = upsertIdpConfig({ tenantId: "t1", protocol: "saml", idpLabel: "Okta" });
    const b = upsertIdpConfig({
      tenantId: "t1",
      protocol: "oidc",
      idpLabel: "Entra",
      enabled: true,
      attributeMapping: { role: "groups", defaultRole: "DISTRICT_ADMIN" },
    });
    expect(b.id).toBe(a.id);
    expect(listIdpConfigs("t1")).toHaveLength(1);
    expect(b.protocol).toBe("oidc");
    expect(b.enabled).toBe(true);
    // Partial mapping merges over the prior mapping.
    expect(b.attributeMapping.role).toBe("groups");
    expect(b.attributeMapping.defaultRole).toBe("DISTRICT_ADMIN");
    expect(b.attributeMapping.email).toBe("email");
  });

  it("scopes listIdpConfigs by tenant", () => {
    upsertIdpConfig({ tenantId: "t1", protocol: "saml", idpLabel: "A" });
    upsertIdpConfig({ tenantId: "t2", protocol: "oidc", idpLabel: "B" });
    expect(listIdpConfigs("t1")).toHaveLength(1);
    expect(listIdpConfigs()).toHaveLength(2);
  });

  it("deletes a config", () => {
    const rec = upsertIdpConfig({ tenantId: "t1", protocol: "saml", idpLabel: "A" });
    expect(deleteIdpConfig(rec.id)).toBe(true);
    expect(getIdpConfig(rec.id)).toBeNull();
    expect(deleteIdpConfig(rec.id)).toBe(false);
  });

  it("issues a SCIM token, returning the plaintext once and storing only a preview", () => {
    const rec = upsertIdpConfig({ tenantId: "t1", protocol: "saml", idpLabel: "A" });
    const issued = issueScimToken(rec.id, "prod", "admin-1");
    expect(issued).not.toBeNull();
    expect(issued!.token.startsWith("scim_")).toBe(true);
    expect(issued!.preview.last4).toBe(issued!.token.slice(-4));
    expect(issued!.preview.label).toBe("prod");
    // Issuing flips scimEnabled on.
    expect(getIdpConfig(rec.id)?.scimEnabled).toBe(true);
    // The stored preview never contains the full token.
    const active = listActiveScimTokens(rec.id);
    expect(active).toHaveLength(1);
    expect(JSON.stringify(active)).not.toContain(issued!.token);
  });

  it("revokes a SCIM token and removes it from the active set", () => {
    const rec = upsertIdpConfig({ tenantId: "t1", protocol: "saml", idpLabel: "A" });
    const issued = issueScimToken(rec.id, "prod", "admin-1")!;
    expect(revokeScimToken(rec.id, issued.preview.id)).toBe(true);
    expect(listActiveScimTokens(rec.id)).toHaveLength(0);
    // Double-revoke is a no-op.
    expect(revokeScimToken(rec.id, issued.preview.id)).toBe(false);
  });

  it("returns null when issuing against an unknown config", () => {
    expect(issueScimToken("nope", "x", null)).toBeNull();
  });
});
