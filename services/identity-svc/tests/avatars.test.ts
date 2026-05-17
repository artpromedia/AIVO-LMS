import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

// Use a per-process temporary storage dir so the tests don't pollute
// the repo's persistent ./data/avatars folder.
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avatar-test-"));
process.env.AVATAR_STORAGE_DIR = tmpRoot;

const {
  processAndStoreAvatar,
  deleteAvatarsFor,
  AvatarValidationError,
  AVATAR_MAX_BYTES,
} = await import("../src/lib/avatar-storage.ts");

async function makePngBuffer(size = 400) {
  return await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 80, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

test("processAndStoreAvatar happy path: stores main + thumb, returns URLs", async () => {
  const userId = "user-happy";
  const buf = await makePngBuffer();

  const result = await processAndStoreAvatar({
    userId,
    buffer: buf,
    mimetype: "image/png",
  });

  assert.match(result.url, /^\/api\/avatars\/user-happy\/[a-f0-9]+\.webp$/);
  assert.match(result.thumbnailUrl, /-thumb\.webp$/);

  const mainBytes = await fs.readFile(path.join(tmpRoot, result.storedPaths.main));
  const meta = await sharp(mainBytes).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.height, 256);
  assert.equal(meta.format, "webp");

  const thumbBytes = await fs.readFile(path.join(tmpRoot, result.storedPaths.thumb));
  const thumbMeta = await sharp(thumbBytes).metadata();
  assert.equal(thumbMeta.width, 64);
  assert.equal(thumbMeta.height, 64);
});

test("processAndStoreAvatar rejects unsupported mimetype", async () => {
  const buf = await makePngBuffer(100);
  await assert.rejects(
    processAndStoreAvatar({
      userId: "user-mime",
      buffer: buf,
      mimetype: "image/gif",
    }),
    (err: any) =>
      err instanceof AvatarValidationError &&
      err.statusCode === 415 &&
      err.code === "unsupported_media_type",
  );
});

test("processAndStoreAvatar rejects oversized file", async () => {
  // Construct a buffer larger than the 5 MB limit without actually
  // generating a giant image — the size check runs before sharp.
  const huge = Buffer.alloc(AVATAR_MAX_BYTES + 1, 0);
  await assert.rejects(
    processAndStoreAvatar({
      userId: "user-big",
      buffer: huge,
      mimetype: "image/png",
    }),
    (err: any) =>
      err instanceof AvatarValidationError &&
      err.statusCode === 413 &&
      err.code === "file_too_large",
  );
});

test("processAndStoreAvatar rejects non-image bytes", async () => {
  await assert.rejects(
    processAndStoreAvatar({
      userId: "user-bad",
      buffer: Buffer.from("this is not an image, just text"),
      mimetype: "image/png",
    }),
    (err: any) =>
      err instanceof AvatarValidationError && err.code === "invalid_image",
  );
});

test("deleteAvatarsFor removes the user's storage dir", async () => {
  const userId = "user-delete";
  const buf = await makePngBuffer(120);
  await processAndStoreAvatar({ userId, buffer: buf, mimetype: "image/png" });

  const userDir = path.join(tmpRoot, userId);
  const before = await fs.readdir(userDir);
  assert.ok(before.length >= 2);

  await deleteAvatarsFor(userId);

  await assert.rejects(fs.readdir(userDir));
});
