import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

/**
 * Avatar storage layer for adult-user profile photos (parents, teachers,
 * admins, district staff). Learner avatars are intentionally a different
 * (gamified) system and are not handled here.
 *
 * For now we store re-encoded WebP files on the local filesystem under
 * `<repo>/data/avatars/<userId>/<hash>.webp` and serve them via a static
 * route mounted by `services/identity-svc/src/index.ts` at `/api/avatars/`.
 * This keeps the upload pipeline self-contained (no external bucket
 * provisioning required) and makes the on-disk artefacts trivial to inspect
 * during development. The `processAndStoreAvatar` / `deleteAvatar` API is
 * deliberately backend-agnostic — switching to Replit Object Storage or any
 * S3-compatible bucket later is a one-file change.
 */

const STORAGE_ROOT =
  process.env.AVATAR_STORAGE_DIR || path.resolve(process.cwd(), "../../data/avatars");

const PUBLIC_URL_PREFIX = process.env.AVATAR_PUBLIC_URL_PREFIX || "/api/avatars";

/**
 * S3 backend (e.g. in-cluster MinIO). Enabled when `AVATAR_S3_BUCKET` is set.
 * When enabled, files live in `<bucket>/<userId>/<file>` and `/api/avatars/...`
 * GETs are streamed via the route registered in `src/index.ts`.
 */
const S3_BUCKET = process.env.AVATAR_S3_BUCKET || "";
const S3_ENABLED = S3_BUCKET.length > 0;
let s3Client: S3Client | null = null;
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AVATAR_S3_REGION || "us-east-1",
      endpoint: process.env.AVATAR_S3_ENDPOINT || undefined,
      forcePathStyle: (process.env.AVATAR_S3_FORCE_PATH_STYLE || "true") === "true",
      credentials: process.env.AVATAR_S3_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AVATAR_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.AVATAR_S3_SECRET_ACCESS_KEY || "",
          }
        : undefined,
    });
  }
  return s3Client;
}

export const AVATAR_S3_ENABLED = S3_ENABLED;

export const AVATAR_STORAGE_ROOT = STORAGE_ROOT;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAIN_SIZE = 256;
export const AVATAR_THUMB_SIZE = 64;
export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export class AvatarValidationError extends Error {
  statusCode: number;
  code: string;
  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ProcessedAvatar {
  /** Public URL of the main 256×256 image, suitable for `users.avatarUrl`. */
  url: string;
  /** Public URL of the 64×64 thumbnail. */
  thumbnailUrl: string;
  /** Relative storage paths so callers can clean up the previous photo. */
  storedPaths: { main: string; thumb: string };
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function publicUrlFor(userId: string, file: string) {
  return `${PUBLIC_URL_PREFIX}/${userId}/${file}`;
}

function relPathFor(userId: string, file: string) {
  return path.posix.join(userId, file);
}

/**
 * Validate, decode, re-encode (square, 256×256 main + 64×64 thumb), strip
 * EXIF, and persist the avatar for `userId`. Returns the new public URL +
 * the on-disk paths so the caller can delete the previous photo.
 */
export async function processAndStoreAvatar(opts: {
  userId: string;
  buffer: Buffer;
  mimetype: string;
}): Promise<ProcessedAvatar> {
  const { userId, buffer, mimetype } = opts;

  if (!ALLOWED_MIME.has(mimetype)) {
    throw new AvatarValidationError(
      "unsupported_media_type",
      "Avatar must be JPEG, PNG, or WebP.",
      415,
    );
  }
  if (buffer.length > AVATAR_MAX_BYTES) {
    throw new AvatarValidationError(
      "file_too_large",
      `Avatar must be at most ${AVATAR_MAX_BYTES} bytes.`,
      413,
    );
  }
  if (buffer.length === 0) {
    throw new AvatarValidationError("empty_file", "Empty upload.", 400);
  }

  // Decode to confirm this really is an image. sharp throws on garbage
  // input, which we map to a 400 instead of a 500. `rotate()` honours the
  // EXIF orientation flag and then re-encoding to WebP drops all metadata
  // including EXIF GPS tags.
  let pipeline: sharp.Sharp;
  try {
    pipeline = sharp(buffer, { failOn: "error" }).rotate();
    await pipeline.metadata();
  } catch {
    throw new AvatarValidationError("invalid_image", "Uploaded file is not a valid image.", 400);
  }

  const main = await sharp(buffer)
    .rotate()
    .resize(AVATAR_MAIN_SIZE, AVATAR_MAIN_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: 85 })
    .toBuffer();

  const thumb = await sharp(buffer)
    .rotate()
    .resize(AVATAR_THUMB_SIZE, AVATAR_THUMB_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: 80 })
    .toBuffer();

  const hash = createHash("sha1").update(main).digest("hex").slice(0, 16);
  const mainName = `${hash}.webp`;
  const thumbName = `${hash}-thumb.webp`;

  const userDir = path.join(STORAGE_ROOT, userId);
  if (S3_ENABLED) {
    const s3 = getS3();
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: `${userId}/${mainName}`,
        Body: main,
        ContentType: "image/webp",
        CacheControl: "public, max-age=604800",
      }),
    );
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: `${userId}/${thumbName}`,
        Body: thumb,
        ContentType: "image/webp",
        CacheControl: "public, max-age=604800",
      }),
    );
  } else {
    await ensureDir(userDir);
    await fs.writeFile(path.join(userDir, mainName), main);
    await fs.writeFile(path.join(userDir, thumbName), thumb);
  }

  return {
    url: publicUrlFor(userId, mainName),
    thumbnailUrl: publicUrlFor(userId, thumbName),
    storedPaths: {
      main: relPathFor(userId, mainName),
      thumb: relPathFor(userId, thumbName),
    },
  };
}

/**
 * Delete every avatar file owned by `userId`. Used by both DELETE
 * /api/users/me/avatar and on replace (best-effort cleanup of the prior
 * photo). Missing files are not an error.
 */
export async function deleteAvatarsFor(userId: string): Promise<void> {
  if (S3_ENABLED) {
    const s3 = getS3();
    try {
      const list = await s3.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: `${userId}/`,
        }),
      );
      const keys = (list.Contents || []).map((o) => ({ Key: o.Key! })).filter((k) => k.Key);
      if (keys.length > 0) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: S3_BUCKET,
            Delete: { Objects: keys, Quiet: true },
          }),
        );
      }
    } catch {
      // best-effort
    }
    return;
  }
  const userDir = path.join(STORAGE_ROOT, userId);
  try {
    await fs.rm(userDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

/**
 * Best-effort delete of a single previously-stored avatar URL. Accepts
 * either the full public URL (e.g. `/api/avatars/<userId>/<hash>.webp`)
 * or `null`. Used when a user replaces their photo.
 */
export async function deletePreviousAvatarUrl(
  userId: string,
  previousUrl: string | null | undefined,
): Promise<void> {
  if (!previousUrl) return;
  const expectedPrefix = `${PUBLIC_URL_PREFIX}/${userId}/`;
  if (!previousUrl.startsWith(expectedPrefix)) return;
  const file = previousUrl.slice(expectedPrefix.length);
  // Strip path traversal attempts.
  if (file.includes("..") || file.includes("/")) return;
  // Also remove the matching thumb.
  const baseName = file.replace(/\.webp$/, "");
  if (S3_ENABLED) {
    const s3 = getS3();
    await Promise.all([
      s3
        .send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: `${userId}/${file}` }))
        .catch(() => undefined),
      s3
        .send(
          new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: `${userId}/${baseName}-thumb.webp` }),
        )
        .catch(() => undefined),
    ]);
    return;
  }
  const targets = [
    path.join(STORAGE_ROOT, userId, file),
    path.join(STORAGE_ROOT, userId, `${baseName}-thumb.webp`),
  ];
  await Promise.all(targets.map((p) => fs.rm(p, { force: true }).catch(() => undefined)));
}

/**
 * Stream an avatar object from S3. Returns null if the object doesn't exist
 * or the backend isn't S3.
 */
export async function getAvatarObjectFromS3(
  userId: string,
  file: string,
): Promise<{ body: Readable; contentType: string; contentLength?: number; etag?: string } | null> {
  if (!S3_ENABLED) return null;
  if (file.includes("..") || file.includes("/")) return null;
  try {
    const out = await getS3().send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: `${userId}/${file}`,
      }),
    );
    return {
      body: out.Body as Readable,
      contentType: out.ContentType || "image/webp",
      contentLength: out.ContentLength,
      etag: out.ETag,
    };
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey") {
      return null;
    }
    throw err;
  }
}
