import { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { curriculumUploads, learners, learnerTeachers } from "@aivo/db";
import { verifyJWT, JWTPayload } from "@aivo/security";
import {
  tutorsCurriculumParsePreviewSchema,
  tutorsCurriculumUploadSchema,
  getTutorsCurriculumLearnerByLearnerIdSchema,
  getTutorsCurriculumMineSchema,
  getTutorsCurriculumLearnerByLearnerIdActiveSchema,
  deleteTutorsCurriculumByIdSchema,
} from "./schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`tutor-svc: ${name} must be set in production`);
  return devDefault;
}
const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3004");
if (IS_PROD && !process.env.INTERNAL_AI_TOKEN) {
  throw new Error(
    "INTERNAL_AI_TOKEN must be set in production (shared secret between tutor-svc and ai-svc).",
  );
}
const INTERNAL_AI_TOKEN = process.env.INTERNAL_AI_TOKEN || "dev-tutor-svc-internal";

const VALID_SUBJECTS = new Set([
  "math",
  "ela",
  "science",
  "history",
  "coding",
  "speech",
  "sel",
  "art",
  "other",
]);

// Shared secret for trusted inter-service calls (e.g. the web-v2 BFF, which
// has already enforced session + role + learner-scope before proxying here).
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "";
if (process.env.NODE_ENV === "production" && !INTERNAL_SERVICE_TOKEN) {
  throw new Error(
    "tutor-svc: INTERNAL_SERVICE_TOKEN must be set in production (shared secret for inter-service calls).",
  );
}

/** Synthetic principal for a trusted service-to-service caller. */
const SERVICE_ROLE = "SERVICE";

async function extractAuth(request: FastifyRequest): Promise<JWTPayload | null> {
  // Trusted inter-service caller: a valid shared service token stands in for a
  // user. The calling service is responsible for its own authz (web-v2's BFF
  // runs requireSession + requireRole + requireLearnerScope before proxying).
  const serviceToken = request.headers["x-service-token"];
  if (
    INTERNAL_SERVICE_TOKEN &&
    typeof serviceToken === "string" &&
    serviceToken === INTERNAL_SERVICE_TOKEN
  ) {
    return { sub: "service", role: SERVICE_ROLE, tenantId: "" } as JWTPayload;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    const cookieHeader = request.headers.cookie || "";
    const match = cookieHeader.match(/access_token=([^;]+)/);
    if (!match) return null;
    try {
      return await verifyJWT(match[1]);
    } catch {
      return null;
    }
  }
  try {
    return await verifyJWT(authHeader.slice(7));
  } catch {
    return null;
  }
}

async function verifyLearnerOwnership(
  db: any,
  learnerId: string,
  authUser: JWTPayload,
): Promise<{ ok: boolean; tenantId?: string }> {
  // Trusted service principal: the calling service already authorized the user
  // and verified learner scope. Resolve the learner's tenant so inserts/reads
  // stay tenant-correct, but don't require a parent/teacher link.
  if (authUser.role === SERVICE_ROLE) {
    const [l] = await db
      .select({ tenantId: learners.tenantId })
      .from(learners)
      .where(eq(learners.id, learnerId));
    return { ok: !!l, tenantId: l?.tenantId };
  }

  if (authUser.role === "PLATFORM_ADMIN" || authUser.role === "DISTRICT_ADMIN") {
    const [l] = await db
      .select({ tenantId: learners.tenantId })
      .from(learners)
      .where(eq(learners.id, learnerId));
    return { ok: !!l, tenantId: l?.tenantId };
  }

  const [learner] = await db
    .select({ parentId: learners.parentId, tenantId: learners.tenantId, userId: learners.userId })
    .from(learners)
    .where(eq(learners.id, learnerId));
  if (!learner) return { ok: false };

  if (authUser.sub === learnerId) return { ok: true, tenantId: learner.tenantId };
  if (learner.parentId === authUser.sub) return { ok: true, tenantId: learner.tenantId };
  if (learner.userId === authUser.sub) return { ok: true, tenantId: learner.tenantId };

  if (authUser.role === "TEACHER") {
    const [link] = await db
      .select({ id: learnerTeachers.id })
      .from(learnerTeachers)
      .where(
        and(
          eq(learnerTeachers.learnerId, learnerId),
          eq(learnerTeachers.teacherUserId, authUser.sub),
        ),
      )
      .limit(1);
    if (link) return { ok: true, tenantId: learner.tenantId };
  }

  return { ok: false };
}

function parseDateOrNull(input: unknown): Date | null {
  if (!input || typeof input !== "string") return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeSubject(s: any): string {
  const v = String(s || "other")
    .toLowerCase()
    .trim();
  return VALID_SUBJECTS.has(v) ? v : "other";
}

function clampTitle(s: any, fallback: string): string {
  const v = (typeof s === "string" ? s : "").trim();
  return (v || fallback).slice(0, 255);
}

interface ParsedFocus {
  title?: string | null;
  subject?: string;
  weekStart?: string | null;
  weekEnd?: string | null;
  topics?: string[];
  keywords?: string[];
  standards?: string[];
  skills?: string[];
  summary?: string;
  confidence?: number;
}

async function parseWithAI(args: {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  hintedSubject?: string;
  hintedWeekStart?: string;
  hintedWeekEnd?: string;
}): Promise<{ parsed: ParsedFocus; rawText: string }> {
  const res = await fetch(`${AI_SVC_URL}/api/ai/curriculum/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Auth": INTERNAL_AI_TOKEN,
    },
    body: JSON.stringify({
      text: args.text || null,
      image_base64: args.imageBase64 || null,
      mime_type: args.mimeType || "image/jpeg",
      hinted_subject: args.hintedSubject || null,
      hinted_week_start: args.hintedWeekStart || null,
      hinted_week_end: args.hintedWeekEnd || null,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ai-svc parse failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return {
    parsed: data,
    rawText: data.raw_text || args.text || "",
  };
}

const MAX_TEXT_LEN = 32000;
const MAX_BASE64_LEN = 7_000_000; // ~5 MB raw

const ALLOWED_MIME_PREFIXES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
];
const ALLOWED_MIME_EXACT = new Set(["application/pdf", "text/plain"]);
function isAllowedMimeType(mt: unknown): boolean {
  if (typeof mt !== "string" || mt.length === 0) return false;
  const lower = mt.toLowerCase().split(";")[0].trim();
  if (ALLOWED_MIME_EXACT.has(lower)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => lower === p);
}

export async function getActiveCurriculumFocus(
  db: any,
  learnerId: string,
  subject?: string,
): Promise<Record<string, unknown> | null> {
  const conditions = [
    eq(curriculumUploads.learnerId, learnerId),
    eq(curriculumUploads.status, "ACTIVE"),
  ];
  if (subject) {
    conditions.push(
      or(
        eq(curriculumUploads.subject, normalizeSubject(subject)),
        eq(curriculumUploads.subject, "other"),
      )!,
    );
  }
  const rows = await db
    .select()
    .from(curriculumUploads)
    .where(and(...conditions))
    .orderBy(desc(curriculumUploads.createdAt))
    .limit(20);

  const now = Date.now();
  // Pick the most recent ACTIVE row whose week window contains "now" (null
  // edges are treated as "always started" / "never expires"). This way an
  // uploaded future-dated plan does not displace the current focus.
  const current = rows.find((r: any) => {
    const startMs = r.weekStart ? new Date(r.weekStart).getTime() : -Infinity;
    const endMs = r.weekEnd ? new Date(r.weekEnd).getTime() + 24 * 3600 * 1000 : Infinity;
    return startMs <= now && now <= endMs;
  });
  const row = current || rows.find((r: any) => !r.weekStart && !r.weekEnd);
  if (!row) return null;

  const focus = (row.parsedFocus as Record<string, unknown>) || {};
  return {
    ...focus,
    title: row.title || (focus as any).title,
    subject: row.subject,
    weekStart: row.weekStart || (focus as any).weekStart,
    weekEnd: row.weekEnd || (focus as any).weekEnd,
    uploadId: row.id,
  };
}

export function registerCurriculumRoutes(app: FastifyInstance, db: any) {
  // POST /api/tutors/curriculum/parse-preview
  // Parses raw text or an image with the AI and returns the structured focus
  // WITHOUT persisting anything. The client then lets the user edit the
  // result and POSTs the cleaned-up focus to /upload to actually save it.
  app.post(
    "/api/tutors/curriculum/parse-preview",
    { schema: tutorsCurriculumParsePreviewSchema },
    async (request, reply) => {
      const authUser = await extractAuth(request);
      if (!authUser) return reply.code(401).send({ error: "Authentication required" });

      const body = (request.body || {}) as any;
      const text: string | undefined =
        typeof body.text === "string" ? body.text.slice(0, MAX_TEXT_LEN) : undefined;
      const imageBase64: string | undefined =
        typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
      if (!text && !imageBase64) {
        return reply.code(400).send({ error: "Provide either text or imageBase64" });
      }
      if (imageBase64 && imageBase64.length > MAX_BASE64_LEN) {
        return reply.code(413).send({ error: "Uploaded file is too large (max 5 MB)" });
      }
      if (imageBase64 && !isAllowedMimeType(body.mimeType)) {
        return reply.code(415).send({
          error:
            "Unsupported file type. Please upload an image (PNG/JPG/WebP), PDF, or plain text.",
        });
      }
      try {
        const { parsed, rawText } = await parseWithAI({
          text,
          imageBase64,
          mimeType: body.mimeType,
          hintedSubject: body.subject ? normalizeSubject(body.subject) : undefined,
          hintedWeekStart: body.weekStart,
          hintedWeekEnd: body.weekEnd,
        });
        return {
          parsed: {
            ...parsed,
            subject: normalizeSubject(parsed.subject || body.subject),
          },
          rawText,
        };
      } catch (err: any) {
        return reply
          .code(502)
          .send({ error: "Failed to parse curriculum content", detail: err.message });
      }
    },
  );

  // POST /api/tutors/curriculum/upload
  // Body: { learnerId? | applyToLearnerIds?, subject, title?, text?, imageBase64?,
  //         mimeType?, fileName?, weekStart?, weekEnd?, notes? }
  app.post(
    "/api/tutors/curriculum/upload",
    { schema: tutorsCurriculumUploadSchema },
    async (request, reply) => {
      const authUser = await extractAuth(request);
      if (!authUser) return reply.code(401).send({ error: "Authentication required" });

      const body = (request.body || {}) as any;
      const subject = normalizeSubject(body.subject);
      const text: string | undefined =
        typeof body.text === "string" ? body.text.slice(0, MAX_TEXT_LEN) : undefined;
      const imageBase64: string | undefined =
        typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
      const hasParsed = body.parsedFocus && typeof body.parsedFocus === "object";

      // When the client sent a reviewed parsedFocus from /parse-preview, raw
      // text/image are optional (already consumed during preview). Otherwise
      // the server has to parse, so we need raw input.
      if (!hasParsed && !text && !imageBase64) {
        return reply
          .code(400)
          .send({ error: "Provide either text or imageBase64 (or parsedFocus from preview)" });
      }
      if (imageBase64 && imageBase64.length > MAX_BASE64_LEN) {
        return reply.code(413).send({ error: "Uploaded file is too large (max 5 MB)" });
      }
      if (imageBase64 && !isAllowedMimeType(body.mimeType)) {
        return reply.code(415).send({
          error:
            "Unsupported file type. Please upload an image (PNG/JPG/WebP), PDF, or plain text.",
        });
      }

      const isTeacher = authUser.role === "TEACHER";
      const uploaderRole = isTeacher ? "TEACHER" : authUser.role || "PARENT";
      const learnerIdsRaw: string[] = Array.isArray(body.applyToLearnerIds)
        ? body.applyToLearnerIds
        : body.learnerId
          ? [body.learnerId]
          : [];
      if (learnerIdsRaw.length === 0) {
        return reply.code(400).send({ error: "learnerId or applyToLearnerIds required" });
      }
      if (learnerIdsRaw.length > 100) {
        return reply.code(400).send({ error: "Cannot apply to more than 100 learners at once" });
      }

      // Verify access to each learner.
      const allowed: { id: string; tenantId?: string }[] = [];
      for (const lid of learnerIdsRaw) {
        const { ok, tenantId } = await verifyLearnerOwnership(db, lid, authUser);
        if (ok) allowed.push({ id: lid, tenantId });
      }
      if (allowed.length === 0) {
        return reply
          .code(403)
          .send({ error: "You do not have access to the specified learner(s)" });
      }

      let parsed: ParsedFocus;
      let rawText: string;
      // Path A: client did parse-preview, edited the result, and POSTed it back.
      // Trust the structured fields but normalize and clamp them.
      if (body.parsedFocus && typeof body.parsedFocus === "object") {
        const pf = body.parsedFocus as any;
        parsed = {
          title: typeof pf.title === "string" ? pf.title.slice(0, 200) : undefined,
          subject: normalizeSubject(pf.subject || subject),
          weekStart: typeof pf.weekStart === "string" ? pf.weekStart : undefined,
          weekEnd: typeof pf.weekEnd === "string" ? pf.weekEnd : undefined,
          topics: Array.isArray(pf.topics) ? pf.topics.slice(0, 50).map(String) : [],
          keywords: Array.isArray(pf.keywords) ? pf.keywords.slice(0, 100).map(String) : [],
          standards: Array.isArray(pf.standards) ? pf.standards.slice(0, 50).map(String) : [],
          skills: Array.isArray(pf.skills) ? pf.skills.slice(0, 50).map(String) : [],
          summary: typeof pf.summary === "string" ? pf.summary.slice(0, 2000) : "",
          confidence: typeof pf.confidence === "number" ? pf.confidence : 1,
        };
        rawText = (text || "").slice(0, MAX_TEXT_LEN);
      } else {
        // Path B: server-side parse (legacy / shortcut path).
        try {
          const result = await parseWithAI({
            text,
            imageBase64,
            mimeType: body.mimeType,
            hintedSubject: subject !== "other" ? subject : undefined,
            hintedWeekStart: body.weekStart,
            hintedWeekEnd: body.weekEnd,
          });
          parsed = result.parsed;
          rawText = result.rawText;
        } catch (err: any) {
          return reply
            .code(502)
            .send({ error: "Failed to parse curriculum content", detail: err.message });
        }
      }

      const finalSubject = normalizeSubject(parsed.subject || subject);
      const fallbackTitle = `${finalSubject.toUpperCase()} focus · ${new Date().toLocaleDateString()}`;
      const title = clampTitle(body.title || parsed.title, fallbackTitle);

      const weekStartStr = parsed.weekStart || body.weekStart || null;
      const weekEndStr = parsed.weekEnd || body.weekEnd || null;
      const weekStartDate = parseDateOrNull(weekStartStr);
      const weekEndDate = parseDateOrNull(weekEndStr);

      const classGroupId = allowed.length > 1 ? crypto.randomUUID() : null;

      const inserts = allowed.map((l) => ({
        tenantId: l.tenantId,
        learnerId: l.id,
        uploadedBy: authUser.sub,
        uploaderRole,
        subject: finalSubject,
        title,
        sourceType:
          typeof body.sourceType === "string" &&
          (body.sourceType === "file" || body.sourceType === "text")
            ? body.sourceType
            : imageBase64
              ? "file"
              : "text",
        fileName: body.fileName || null,
        mimeType: body.mimeType || null,
        rawText: rawText.slice(0, MAX_TEXT_LEN),
        parsedFocus: {
          title: parsed.title,
          subject: finalSubject,
          weekStart: weekStartDate ? weekStartDate.toISOString().slice(0, 10) : null,
          weekEnd: weekEndDate ? weekEndDate.toISOString().slice(0, 10) : null,
          topics: parsed.topics || [],
          keywords: parsed.keywords || [],
          standards: parsed.standards || [],
          skills: parsed.skills || [],
          summary: parsed.summary || "",
          confidence: parsed.confidence ?? 0,
        },
        weekStart: weekStartDate,
        weekEnd: weekEndDate,
        status: "ACTIVE",
        notes: body.notes || null,
        classGroupId,
      }));

      // Atomically archive prior ACTIVE rows for each (learner, subject) and
      // insert the new ACTIVE rows so concurrent uploads can't leave duplicates.
      //
      // Smart archival: if the new upload is FUTURE-dated (weekStart > today),
      // do NOT archive a still-current plan — both can coexist as ACTIVE and
      // getActiveCurriculumFocus picks the one whose window contains "now".
      const todayMs = Date.now();
      const newIsFuture = !!(weekStartDate && weekStartDate.getTime() > todayMs);
      const created = await db.transaction(async (tx: any) => {
        for (const ins of inserts) {
          if (newIsFuture) {
            // Only archive prior ACTIVE rows that have already expired or end
            // before the new plan starts; leave a current plan in place.
            const newStartMs = (ins.weekStart as Date).getTime();
            const existing = await tx
              .select()
              .from(curriculumUploads)
              .where(
                and(
                  eq(curriculumUploads.learnerId, ins.learnerId),
                  eq(curriculumUploads.subject, ins.subject),
                  eq(curriculumUploads.status, "ACTIVE"),
                ),
              );
            for (const row of existing as any[]) {
              const endMs = row.weekEnd
                ? new Date(row.weekEnd).getTime() + 24 * 3600 * 1000
                : Infinity;
              if (endMs <= newStartMs) {
                await tx
                  .update(curriculumUploads)
                  .set({ status: "ARCHIVED", updatedAt: new Date() })
                  .where(eq(curriculumUploads.id, row.id));
              }
            }
          } else {
            await tx
              .update(curriculumUploads)
              .set({ status: "ARCHIVED", updatedAt: new Date() })
              .where(
                and(
                  eq(curriculumUploads.learnerId, ins.learnerId),
                  eq(curriculumUploads.subject, ins.subject),
                  eq(curriculumUploads.status, "ACTIVE"),
                ),
              );
          }
        }
        return tx.insert(curriculumUploads).values(inserts).returning();
      });

      return reply.code(201).send({
        uploads: created.map((row: any) => ({
          id: row.id,
          learnerId: row.learnerId,
          subject: row.subject,
          title: row.title,
          status: row.status,
          weekStart: row.weekStart,
          weekEnd: row.weekEnd,
          parsedFocus: row.parsedFocus,
          createdAt: row.createdAt,
        })),
        classGroupId,
        learnerCount: allowed.length,
      });
    },
  );

  // GET /api/tutors/curriculum/learner/:learnerId?subject=&status=
  app.get(
    "/api/tutors/curriculum/learner/:learnerId",
    { schema: getTutorsCurriculumLearnerByLearnerIdSchema },
    async (request, reply) => {
      const authUser = await extractAuth(request);
      if (!authUser) return reply.code(401).send({ error: "Authentication required" });

      const { learnerId } = request.params as any;
      const { ok } = await verifyLearnerOwnership(db, learnerId, authUser);
      if (!ok) return reply.code(403).send({ error: "You do not have access to this learner" });

      const q = (request.query || {}) as any;
      const conds = [eq(curriculumUploads.learnerId, learnerId)];
      if (q.subject) conds.push(eq(curriculumUploads.subject, normalizeSubject(q.subject)));
      if (q.status) conds.push(eq(curriculumUploads.status, String(q.status)));

      const rows = await db
        .select()
        .from(curriculumUploads)
        .where(and(...conds))
        .orderBy(desc(curriculumUploads.createdAt))
        .limit(50);

      return {
        uploads: rows.map((r: any) => ({
          id: r.id,
          learnerId: r.learnerId,
          subject: r.subject,
          title: r.title,
          status: r.status,
          sourceType: r.sourceType,
          fileName: r.fileName,
          weekStart: r.weekStart,
          weekEnd: r.weekEnd,
          parsedFocus: r.parsedFocus,
          uploaderRole: r.uploaderRole,
          notes: r.notes,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      };
    },
  );

  // GET /api/tutors/curriculum/mine?limit= — recent uploads by the
  // authenticated user (teacher upload history). Each row includes
  // learnerId so the UI can display which learners received it.
  app.get(
    "/api/tutors/curriculum/mine",
    { schema: getTutorsCurriculumMineSchema },
    async (request, reply) => {
      const authUser = await extractAuth(request);
      if (!authUser) return reply.code(401).send({ error: "Authentication required" });
      const limit = Math.min(50, Math.max(1, parseInt((request.query as any)?.limit, 10) || 20));
      const rows = await db
        .select()
        .from(curriculumUploads)
        .where(eq(curriculumUploads.uploadedBy, authUser.sub))
        .orderBy(desc(curriculumUploads.createdAt))
        .limit(limit);
      return {
        uploads: rows.map((r: any) => ({
          id: r.id,
          learnerId: r.learnerId,
          subject: r.subject,
          title: r.title,
          status: r.status,
          weekStart: r.weekStart,
          weekEnd: r.weekEnd,
          classGroupId: r.classGroupId,
          createdAt: r.createdAt,
        })),
      };
    },
  );

  // GET /api/tutors/curriculum/learner/:learnerId/active?subject=
  app.get(
    "/api/tutors/curriculum/learner/:learnerId/active",
    { schema: getTutorsCurriculumLearnerByLearnerIdActiveSchema },
    async (request, reply) => {
      const authUser = await extractAuth(request);
      if (!authUser) return reply.code(401).send({ error: "Authentication required" });

      const { learnerId } = request.params as any;
      const { ok } = await verifyLearnerOwnership(db, learnerId, authUser);
      if (!ok) return reply.code(403).send({ error: "You do not have access to this learner" });

      const subject = (request.query as any)?.subject as string | undefined;
      const focus = await getActiveCurriculumFocus(db, learnerId, subject);
      return { focus };
    },
  );

  // DELETE /api/tutors/curriculum/:id
  app.delete(
    "/api/tutors/curriculum/:id",
    { schema: deleteTutorsCurriculumByIdSchema },
    async (request, reply) => {
      const authUser = await extractAuth(request);
      if (!authUser) return reply.code(401).send({ error: "Authentication required" });

      const { id } = request.params as any;
      const [row] = await db.select().from(curriculumUploads).where(eq(curriculumUploads.id, id));
      if (!row) return reply.code(404).send({ error: "Upload not found" });

      const { ok } = await verifyLearnerOwnership(db, row.learnerId, authUser);
      const isUploader = row.uploadedBy === authUser.sub;
      const isAdmin = authUser.role === "PLATFORM_ADMIN" || authUser.role === "DISTRICT_ADMIN";
      if (!ok && !isUploader && !isAdmin) {
        return reply.code(403).send({ error: "You cannot delete this upload" });
      }

      await db.delete(curriculumUploads).where(eq(curriculumUploads.id, id));
      return { ok: true, id };
    },
  );
}
