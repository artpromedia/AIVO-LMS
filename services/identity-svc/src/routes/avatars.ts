import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import {
  AVATAR_MAX_BYTES,
  AvatarValidationError,
  deleteAvatarsFor,
  deletePreviousAvatarUrl,
  processAndStoreAvatar,
} from "../lib/avatar-storage.js";

/**
 * Roles allowed to upload a profile photo. Learners are intentionally
 * excluded — their avatar comes from the gamified `avatar_items` system.
 */
const AVATAR_ELIGIBLE_ROLES = new Set([
  "PARENT",
  "TEACHER",
  "CAREGIVER",
  "THERAPIST",
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
]);

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
  if (!req.user?.sub) {
    return reply.status(401).send({ error: "Invalid token" });
  }
  if (!AVATAR_ELIGIBLE_ROLES.has(req.user.role)) {
    return reply.status(403).send({
      error: "Profile photos are only available for adult accounts.",
    });
  }
}

export async function registerAvatarRoutes(app: FastifyInstance) {
  app.post(
    "/api/users/me/avatar",
    {
      schema: {
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;

      if (!(req as any).isMultipart || !(req as any).isMultipart()) {
        return reply.status(400).send({ error: "Expected multipart/form-data." });
      }

      let filePart;
      try {
        filePart = await (req as any).file({ limits: { fileSize: AVATAR_MAX_BYTES } });
      } catch {
        return reply.status(400).send({ error: "Could not read upload." });
      }
      if (!filePart) {
        return reply.status(400).send({ error: "No file provided." });
      }

      let buffer: Buffer;
      try {
        buffer = await filePart.toBuffer();
      } catch (err: any) {
        if (err?.code === "FST_REQ_FILE_TOO_LARGE" || err?.code === "FST_FILES_LIMIT") {
          return reply.status(413).send({
            error: `Avatar must be at most ${AVATAR_MAX_BYTES} bytes.`,
            code: "file_too_large",
          });
        }
        return reply.status(400).send({ error: "Upload failed." });
      }

      const [existing] = await db
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, user.sub))
        .limit(1);

      let processed;
      try {
        processed = await processAndStoreAvatar({
          userId: user.sub,
          buffer,
          mimetype: filePart.mimetype,
        });
      } catch (err) {
        if (err instanceof AvatarValidationError) {
          return reply.status(err.statusCode).send({
            error: err.message,
            code: err.code,
          });
        }
        throw err;
      }

      await db.update(users).set({ avatarUrl: processed.url }).where(eq(users.id, user.sub));

      // Best-effort: clean up the previously-stored photo so we don't leak
      // bytes on every replace. Failures are swallowed inside the helper.
      if (existing?.avatarUrl && existing.avatarUrl !== processed.url) {
        await deletePreviousAvatarUrl(user.sub, existing.avatarUrl);
      }

      return {
        avatarUrl: processed.url,
        thumbnailUrl: processed.thumbnailUrl,
      };
    },
  );

  app.delete(
    "/api/users/me/avatar",
    {
      schema: { tags: ["Users"], security: [{ bearerAuth: [] }] },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;

      await db.update(users).set({ avatarUrl: null }).where(eq(users.id, user.sub));

      await deleteAvatarsFor(user.sub);

      return reply.status(204).send();
    },
  );
}
