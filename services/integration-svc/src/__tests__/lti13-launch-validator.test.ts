import { describe, expect, it } from "vitest";
import { validateLtiLaunch } from "../services/lti13-launch-validator.js";

const SIGNED_TOKEN = "header.payload.signature";

const SAMPLE = {
  issuer: "https://lms.example.com",
  client_id: "client-1",
  deployment_id: "dep-1",
  target_link_uri: "https://aivo.example/launch",
  nonce: "n1",
  state: "s1",
  id_token: SIGNED_TOKEN,
  roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
  context: { id: "ctx-1" },
  resource_link: { id: "rl-1" },
};

describe("validateLtiLaunch", () => {
  it("accepts a well-formed signed launch", () => {
    const result = validateLtiLaunch(SAMPLE);
    expect(result.valid).toBe(true);
  });

  it("rejects missing fields", () => {
    const result = validateLtiLaunch({ ...SAMPLE, nonce: undefined });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_field")).toBe(true);
  });

  it("rejects unsigned id_token in production mode", () => {
    const result = validateLtiLaunch(
      { ...SAMPLE, id_token: "header.payload." },
      { productionMode: true },
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "unsigned_id_token")).toBe(true);
  });

  it("rejects untrusted issuer when trusted list is provided", () => {
    const result = validateLtiLaunch(
      { ...SAMPLE, issuer: "https://attacker.example" },
      { trustedIssuers: new Set(["https://lms.example.com"]) },
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "untrusted_issuer")).toBe(true);
  });

  it("rejects missing resource link", () => {
    const result = validateLtiLaunch({ ...SAMPLE, resource_link: undefined });
    expect(result.issues.some((i) => i.code === "missing_resource_link")).toBe(true);
  });
});
