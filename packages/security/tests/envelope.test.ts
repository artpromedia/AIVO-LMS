/**
 * Sprint 16 — envelope encryption round-trip + AAD enforcement.
 *
 * Tests live under packages/security/tests (matches the runner glob);
 * the spec's `__tests__` directory is conceptual.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as crypto from "node:crypto";

import {
  encryptForLearnerWithTenant,
  decryptForLearnerWithTenant,
  setKekProvider,
  setTenantResolver,
  currentKekVersion,
  type SealedPayload,
} from "../src/envelope.js";

// Inject a deterministic KEK provider so the round-trips don't depend
// on env vars. Each tenantId/version pair gets a stable 32-byte key.
setKekProvider(async (tenantId: string, version: number) =>
  crypto.createHash("sha256").update(`test-kek::${tenantId}::v${version}`).digest(),
);

// Tenant resolver — tests that use the per-learner helper override
// this in-place to point every learner at a fixed tenant.
setTenantResolver(async () => "tenant-A");

test("encrypt/decrypt round-trip preserves plaintext", async () => {
  const sealed = await encryptForLearnerWithTenant(
    "the rain in spain stays mainly on the plain",
    "learner-1",
    "tenant-A",
  );
  const out = await decryptForLearnerWithTenant(sealed, "learner-1", "tenant-A");
  assert.equal(out.toString("utf8"), "the rain in spain stays mainly on the plain");
});

test("ciphertext is unreadable without the wrapped DEK", async () => {
  const sealed = await encryptForLearnerWithTenant("super secret", "learner-2", "tenant-A");
  assert.notEqual(sealed.c, Buffer.from("super secret").toString("base64"));
  assert.equal(sealed.wrapped.v, currentKekVersion());
  assert.ok(sealed.wrapped.dek.length > 0);
});

test("decrypting with a different learnerId fails (AAD mismatch)", async () => {
  const sealed = await encryptForLearnerWithTenant("bound to learner-3", "learner-3", "tenant-A");
  await assert.rejects(
    () => decryptForLearnerWithTenant(sealed, "learner-other", "tenant-A"),
    /Unsupported state|Authentication|invalid/i,
  );
});

test("decrypting with a different tenantId fails (KEK mismatch)", async () => {
  const sealed = await encryptForLearnerWithTenant("tenant-A only", "learner-4", "tenant-A");
  await assert.rejects(
    () => decryptForLearnerWithTenant(sealed, "learner-4", "tenant-B"),
    /Unsupported state|Authentication|invalid/i,
  );
});

test("tampered ciphertext fails GCM authentication", async () => {
  const sealed = await encryptForLearnerWithTenant("tamper me", "learner-5", "tenant-A");
  // Flip a byte in the ciphertext.
  const raw = Buffer.from(sealed.c, "base64");
  raw[0] = raw[0] ^ 0x01;
  const tampered: SealedPayload = { ...sealed, c: raw.toString("base64") };
  await assert.rejects(
    () => decryptForLearnerWithTenant(tampered, "learner-5", "tenant-A"),
    /Unsupported state|Authentication|invalid/i,
  );
});

test("wrapped DEK is per-payload (two encrypts yield distinct DEKs+IVs)", async () => {
  const a = await encryptForLearnerWithTenant("payload-A", "learner-6", "tenant-A");
  const b = await encryptForLearnerWithTenant("payload-B", "learner-6", "tenant-A");
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.wrapped.iv, b.wrapped.iv);
  assert.notEqual(a.wrapped.dek, b.wrapped.dek);
});

test("KEK rotation: decrypt still works after KEK_VERSION advances if wrapped.v honoured", async () => {
  const previous = process.env.KEK_VERSION;
  process.env.KEK_VERSION = "1";
  try {
    const sealed = await encryptForLearnerWithTenant(
      "encrypted at v1",
      "learner-7",
      "tenant-A",
    );
    assert.equal(sealed.wrapped.v, 1);
    // Rotate.
    process.env.KEK_VERSION = "2";
    // Decrypt must still use v1 (taken from wrapped.v) — provider
    // returns the v1 KEK because our test provider is deterministic
    // over (tenantId, version).
    const out = await decryptForLearnerWithTenant(sealed, "learner-7", "tenant-A");
    assert.equal(out.toString("utf8"), "encrypted at v1");
  } finally {
    if (previous === undefined) delete process.env.KEK_VERSION;
    else process.env.KEK_VERSION = previous;
  }
});

test("encryptForLearnerWithTenant accepts a Buffer plaintext", async () => {
  const buf = Buffer.from([0x00, 0xff, 0x10, 0x20, 0x30, 0x40]);
  const sealed = await encryptForLearnerWithTenant(buf, "learner-8", "tenant-A");
  const out = await decryptForLearnerWithTenant(sealed, "learner-8", "tenant-A");
  assert.deepEqual(out, buf);
});
