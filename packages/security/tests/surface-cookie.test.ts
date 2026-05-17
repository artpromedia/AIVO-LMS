import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SURFACE_COOKIE_NAME,
  signSurfaceCookieValue,
  verifySurfaceCookieValue,
} from "../src/surface-cookie.js";

const SECRET = "test-secret-for-surface-cookie";

describe("surface-cookie", () => {
  it("uses the documented cookie name", () => {
    assert.equal(SURFACE_COOKIE_NAME, "aivo_session_role");
  });

  it("round-trips a freshly signed cookie", async () => {
    const value = await signSurfaceCookieValue("DISTRICT_ADMIN", 60, SECRET);
    const claims = await verifySurfaceCookieValue(value, SECRET);
    assert.equal(claims?.role, "DISTRICT_ADMIN");
    assert.ok((claims?.exp ?? 0) > Math.floor(Date.now() / 1000));
  });

  it("rejects expired cookies", async () => {
    const value = await signSurfaceCookieValue("PLATFORM_ADMIN", -1, SECRET);
    assert.equal(await verifySurfaceCookieValue(value, SECRET), null);
  });

  it("rejects tampered role", async () => {
    const value = await signSurfaceCookieValue("PARENT", 60, SECRET);
    const [, exp, sig] = value.split(".");
    const tampered = `PLATFORM_ADMIN.${exp}.${sig}`;
    assert.equal(await verifySurfaceCookieValue(tampered, SECRET), null);
  });

  it("rejects tampered signature", async () => {
    const value = await signSurfaceCookieValue("DISTRICT_ADMIN", 60, SECRET);
    const tampered = value.slice(0, -4) + "AAAA";
    assert.equal(await verifySurfaceCookieValue(tampered, SECRET), null);
  });

  it("rejects wrong-secret signatures", async () => {
    const value = await signSurfaceCookieValue("DISTRICT_ADMIN", 60, SECRET);
    assert.equal(await verifySurfaceCookieValue(value, "different-secret"), null);
  });

  it("rejects malformed values", async () => {
    assert.equal(await verifySurfaceCookieValue(undefined, SECRET), null);
    assert.equal(await verifySurfaceCookieValue("", SECRET), null);
    assert.equal(await verifySurfaceCookieValue("only-one-part", SECRET), null);
    assert.equal(await verifySurfaceCookieValue("a.b", SECRET), null);
    assert.equal(await verifySurfaceCookieValue("ROLE.notanumber.sig", SECRET), null);
  });
});
