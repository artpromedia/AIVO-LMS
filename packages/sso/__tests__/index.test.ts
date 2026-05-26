/**
 * Sprint 12.6 — smoke test for @aivo/sso.
 *
 * Exercises the pure helpers (`extractEmail`, `extractName`,
 * `mapRole`, `IDP_PRESETS`) — these never reach into `@aivo/security`
 * envelope crypto, so they're safe to call without a JWT key pair.
 *
 * Encryption (`encryptSsoConfig` / `decryptSsoConfig`) and SAML
 * strategy construction (`buildSaml`) are covered in identity-svc's
 * own integration tests where `MFA_ENCRYPTION_KEY` is provisioned;
 * pulling that here would double the test surface for no extra
 * confidence.
 */
import { describe, it, expect } from "vitest";
import { extractEmail, extractName, mapRole, IDP_PRESETS } from "../src/index";

describe("@aivo/sso smoke", () => {
  it("extractEmail pulls the standard email attribute from a SAML profile", () => {
    const email = extractEmail(
      { email: "User@Example.COM" },
      { enabled: true },
    );
    expect(email).toBe("user@example.com");
  });

  it("extractEmail falls back to nameID when it looks like an email", () => {
    const email = extractEmail(
      { nameID: "alice@example.test" },
      { enabled: true },
    );
    expect(email).toBe("alice@example.test");
  });

  it("extractEmail returns null when the profile carries no email", () => {
    const email = extractEmail({ uid: "abc" }, { enabled: true });
    expect(email).toBeNull();
  });

  it("extractName uses the configured nameAttribute when present", () => {
    const name = extractName(
      { displayName: "Ada Lovelace" },
      { enabled: true, nameAttribute: "displayName" },
    );
    expect(name).toBe("Ada Lovelace");
  });

  it("mapRole returns the documented default when no roleAttribute is configured", () => {
    const role = mapRole({}, { enabled: true });
    expect(role).toBe("DISTRICT_ADMIN");
  });

  it("mapRole honours the tenant-configured roleMap", () => {
    const role = mapRole(
      { role: "Educator" },
      {
        enabled: true,
        roleAttribute: "role",
        roleMap: { Educator: "TEACHER" },
        defaultRole: "PARENT",
      },
    );
    expect(role).toBe("TEACHER");
  });

  it("IDP_PRESETS exposes the canonical Azure / Google / Okta presets", () => {
    expect(IDP_PRESETS.azure).toBeTruthy();
    expect(IDP_PRESETS.google).toBeTruthy();
    expect(IDP_PRESETS.okta).toBeTruthy();
  });
});
