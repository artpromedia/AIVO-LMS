/**
 * Deep-link config parity (ADR 0020 Phase 4).
 *
 * Universal/App Links only fire when THREE artifacts agree on the path set:
 *   1. Android intent filters in `apps/mobile/app.json`
 *   2. iOS Universal Links components in the web-hosted AASA
 *      (`apps/web-v2/public/.well-known/apple-app-site-association`)
 *   3. (Android) a package-level `assetlinks.json` that delegates all URLs.
 *
 * Drift between (1) and (2) silently breaks a link on one platform only —
 * exactly the failure mode that left /verify-email and /reset-password
 * opening the web page instead of the app. This test pins them together so
 * a future path added to one side must be added to the other.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..");
const WEB_WELL_KNOWN = join(MOBILE, "..", "web-v2", "public", ".well-known");

const appJson = JSON.parse(readFileSync(join(MOBILE, "app.json"), "utf8"));
const aasa = JSON.parse(readFileSync(join(WEB_WELL_KNOWN, "apple-app-site-association"), "utf8"));
const assetlinks = JSON.parse(readFileSync(join(WEB_WELL_KNOWN, "assetlinks.json"), "utf8"));

const HOSTS = ["aivo.app", "staging.aivo.app"];
// Cross-cutting auth screens reached by a one-time token link in an email.
const TOKEN_LINK_PATHS = ["/verify-email", "/reset-password"];

/** Strip a trailing AASA wildcard so `/learner/*` and the Android prefix
 *  `/learner` compare equal. */
function normalize(p: string): string {
  return p.replace(/\/\*$/, "");
}

function androidPrefixesForHost(host: string): Set<string> {
  const filter = appJson.expo.android.intentFilters.find((f: any) =>
    (f.data ?? []).some((d: any) => d.host === host),
  );
  const prefixes = (filter?.data ?? [])
    .filter((d: any) => d.host === host && typeof d.pathPrefix === "string")
    .map((d: any) => d.pathPrefix as string);
  return new Set(prefixes);
}

function aasaPaths(): Set<string> {
  const components = aasa.applinks.details.flatMap((d: any) => d.components ?? []);
  return new Set(components.map((c: any) => normalize(c["/"] as string)));
}

describe("deep-link config parity", () => {
  it("both hosts expose the same Android App Link path set", () => {
    const a = [...androidPrefixesForHost("aivo.app")].sort();
    const staging = [...androidPrefixesForHost("staging.aivo.app")].sort();
    expect(staging).toEqual(a);
  });

  it("Android intent filters and the iOS AASA cover the same paths", () => {
    const android = [...androidPrefixesForHost("aivo.app")].sort();
    const ios = [...aasaPaths()].sort();
    expect(ios).toEqual(android);
  });

  it.each(TOKEN_LINK_PATHS)("registers %s on both platforms and both hosts", (path) => {
    for (const host of HOSTS) {
      expect(androidPrefixesForHost(host), `android ${host} missing ${path}`).toContain(path);
    }
    expect(aasaPaths(), `AASA missing ${path}`).toContain(path);
  });

  it("Android assetlinks delegates all URLs for the single package (path filtering lives in app.json)", () => {
    const entry = assetlinks[0];
    expect(entry.target.package_name).toBe(appJson.expo.android.package);
    expect(entry.relation).toContain("delegate_permission/common.handle_all_urls");
  });
});
