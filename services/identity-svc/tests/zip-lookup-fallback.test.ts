/**
 * Sprint A — unit tests for the Geocodio / Null zip lookup fallback.
 *
 * Verifies provider selection by env, no-key handling, and that the
 * Null fallback never makes network calls. Real Geocodio HTTP is not
 * exercised here — that's an integration concern gated by
 * `GEOCODIO_API_KEY` in CI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __resetZipLookupFallback,
  getZipLookupFallback,
} from "../src/services/zip-lookup-fallback.js";

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const original: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    original[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k]!;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const k of Object.keys(original)) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k]!;
    }
  });
}

test("defaults to NullFallback when ZIP_LOOKUP_FALLBACK_PROVIDER is unset", async () => {
  await withEnv(
    { ZIP_LOOKUP_FALLBACK_PROVIDER: undefined, GEOCODIO_API_KEY: undefined },
    async () => {
      __resetZipLookupFallback();
      const fb = getZipLookupFallback();
      assert.equal(fb.name, "null");
      const result = await fb.resolve("90210");
      assert.equal(result.status, "disabled");
    },
  );
});

test("falls back to NullFallback when geocodio is selected without a key", async () => {
  await withEnv(
    { ZIP_LOOKUP_FALLBACK_PROVIDER: "geocodio", GEOCODIO_API_KEY: undefined },
    async () => {
      __resetZipLookupFallback();
      const fb = getZipLookupFallback();
      assert.equal(fb.name, "null");
    },
  );
});

test("selects GeocodioFallback when provider and key are both set", async () => {
  await withEnv(
    { ZIP_LOOKUP_FALLBACK_PROVIDER: "geocodio", GEOCODIO_API_KEY: "test-key" },
    async () => {
      __resetZipLookupFallback();
      const fb = getZipLookupFallback();
      assert.equal(fb.name, "geocodio");
    },
  );
});

test("unknown provider value falls back to NullFallback", async () => {
  await withEnv({ ZIP_LOOKUP_FALLBACK_PROVIDER: "google" }, async () => {
    __resetZipLookupFallback();
    const fb = getZipLookupFallback();
    assert.equal(fb.name, "null");
  });
});
