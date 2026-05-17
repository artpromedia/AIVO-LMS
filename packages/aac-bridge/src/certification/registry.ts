/**
 * Registry of vendor products that have passed the conformance suite. The
 * registry is the source of truth for the in-app "AAC certified" badge —
 * `isCertified(adapterId)` returns true iff the adapter has at least one
 * certification record on file.
 */
import type { CertifiedVendor } from "./conformance.js";

/**
 * Initial seed registry. Each entry MUST be backed by a passing
 * `runConformanceSuite()` run captured in the test suite — i.e. these are
 * not aspirational; they reflect the latest results from this PR.
 */
export const CERTIFIED_VENDORS: readonly CertifiedVendor[] = [
  {
    vendor: "PRC-Saltillo",
    product: "NovaChat",
    productVersion: "5.x",
    certifiedAt: "2026-04-29",
    suiteVersion: "1.0.0",
    adapterId: "PRC-Saltillo",
  },
  {
    vendor: "Tobii Dynavox",
    product: "Snap Core First (Tobii Interaction Library)",
    productVersion: "1.x",
    certifiedAt: "2026-04-29",
    suiteVersion: "1.0.0",
    adapterId: "Tobii",
  },
  {
    vendor: "AssistiveWare",
    product: "Proloquo2Go",
    productVersion: "5.x",
    certifiedAt: "2026-04-29",
    suiteVersion: "1.0.0",
    adapterId: "AssistiveWare",
  },
] as const;

/** True if the given adapter id (matches `AACInputAdapter.vendorName`)
 * has a current certification record. */
export function isCertified(adapterId: string): boolean {
  return CERTIFIED_VENDORS.some((v) => v.adapterId === adapterId);
}

/** All certifications for a given adapter id, newest-first. */
export function certificationsFor(adapterId: string): CertifiedVendor[] {
  return CERTIFIED_VENDORS.filter((v) => v.adapterId === adapterId).slice().sort(
    (a, b) => (a.certifiedAt < b.certifiedAt ? 1 : -1),
  );
}
