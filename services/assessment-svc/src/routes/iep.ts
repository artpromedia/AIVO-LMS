import { FastifyInstance } from "fastify";
import { iepDocuments, iepProfiles, iepGoals, learners, learnerFunctioningLevels } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { eq } from "drizzle-orm";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`assessment-svc: ${name} must be set in production`);
  return devDefault;
}
const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3004");

/** Browser-declared MIME types accepted for an IEP upload. Some browsers omit
 *  or generalize the type, so an empty / octet-stream value is tolerated and
 *  the magic-byte sniff below is the real gate. */
const PDF_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
  "binary/octet-stream",
  "",
]);

export type PdfSafetyResult =
  | { ok: true }
  | { ok: false; status: number; error: string; code: string };

/**
 * In-code upload hardening for the IEP PDF intake (Sprint C-10 / D6). Pure +
 * exported so it is unit-testable without booting Fastify:
 *   - content-type allowlist (browser-declared MIME);
 *   - magic-byte sniff — the bytes MUST begin with the "%PDF-" signature;
 *   - reject encrypted PDFs (an /Encrypt dictionary in the trailer) and
 *     active-content PDFs (/JavaScript, /JS, /Launch, /EmbeddedFile, or an
 *     OpenAction auto-run), which are a malware-delivery vector and which the
 *     downstream text extraction cannot use anyway.
 * This is defense-in-depth, NOT antivirus — real AV is a named follow-up.
 */
export function assertPdfSafety(buffer: Buffer, mimetype?: string): PdfSafetyResult {
  const declared = (mimetype ?? "").toLowerCase().split(";")[0].trim();
  if (!PDF_CONTENT_TYPES.has(declared)) {
    return {
      ok: false,
      status: 415,
      error: "Only PDF uploads are accepted.",
      code: "unsupported_content_type",
    };
  }

  // Magic bytes: a real PDF starts with "%PDF-" (allowing a few leading bytes
  // of BOM / whitespace that some producers emit).
  const head = buffer.subarray(0, 1024).toString("latin1");
  const sig = head.indexOf("%PDF-");
  if (sig === -1 || sig > 8) {
    return {
      ok: false,
      status: 415,
      error: "That file is not a valid PDF (missing PDF signature).",
      code: "not_a_pdf",
    };
  }

  // Scan the raw bytes for encryption + active-content markers. PDF keywords
  // are ASCII tokens, so a latin1 scan of the whole buffer reliably finds them.
  const body = buffer.toString("latin1");
  if (/\/Encrypt\b/.test(body)) {
    return {
      ok: false,
      status: 422,
      error: "Encrypted/password-protected PDFs can't be processed. Please upload an unlocked PDF.",
      code: "pdf_encrypted",
    };
  }
  if (/\/JavaScript\b|\/JS\b|\/Launch\b|\/EmbeddedFile\b|\/OpenAction\b/.test(body)) {
    return {
      ok: false,
      status: 422,
      error: "This PDF contains active content (scripts or embedded files) and was rejected.",
      code: "pdf_active_content",
    };
  }

  return { ok: true };
}

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ error: "Unauthorized" });
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function registerIepRoutes(app: FastifyInstance) {
  app.post(
    "/api/iep/upload",
    {
      schema: {
        tags: ["IEP"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["learnerId", "fileName"],
          properties: {
            learnerId: { type: "string" },
            fileName: { type: "string" },
            fileUrl: { type: "string" },
            parsedData: { type: "object" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const body = req.body as any;

      const [doc] = await db
        .insert(iepDocuments)
        .values({
          learnerId: body.learnerId,
          fileName: body.fileName,
          fileUrl: body.fileUrl,
          parsedData: body.parsedData,
          status: body.parsedData ? "parsed" : "uploaded",
        })
        .returning();

      if (body.parsedData) {
        const parsed = body.parsedData;
        const [profile] = await db
          .insert(iepProfiles)
          .values({
            learnerId: body.learnerId,
            disabilityCategories: parsed.disabilityCategories || [],
            accommodations: parsed.accommodations || [],
            goals: parsed.goals || [],
            gradeLevel: parsed.gradeLevel,
            communicationSystem: parsed.communicationSystem,
            assistiveTechnology: parsed.assistiveTechnology || [],
            recommendedFunctioningLevel: parsed.recommendedFunctioningLevel,
          })
          .returning();

        if (parsed.goals?.length) {
          for (const goal of parsed.goals) {
            await db.insert(iepGoals).values({
              learnerId: body.learnerId,
              iepProfileId: profile.id,
              goalText: goal.text || goal,
              domain: goal.domain,
              baseline: goal.baseline,
              targetCriteria: goal.targetCriteria,
            });
          }
        }

        if (parsed.recommendedFunctioningLevel) {
          await db
            .update(learners)
            .set({ functioningLevel: parsed.recommendedFunctioningLevel })
            .where(eq(learners.id, body.learnerId));

          await db.insert(learnerFunctioningLevels).values({
            learnerId: body.learnerId,
            level: parsed.recommendedFunctioningLevel,
            determinedBy: "iep_parse",
            iepSignals: {
              disabilityCategories: parsed.disabilityCategories,
              communicationSystem: parsed.communicationSystem,
              accommodations: parsed.accommodations,
            },
            confidence: 90,
          });
        }

        return { document: doc, profile };
      }

      return { document: doc };
    },
  );

  app.post(
    "/api/iep/parse",
    {
      schema: {
        tags: ["IEP"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["learnerId", "documentText"],
          properties: {
            learnerId: { type: "string" },
            documentText: { type: "string" },
            fileName: { type: "string" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const body = req.body as { learnerId: string; documentText: string; fileName?: string };

      let parsedData: any;
      try {
        const aiRes = await fetch(`${AI_SVC_URL}/api/ai/parse-iep`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_text: body.documentText, learner_name: "" }),
        });
        if (aiRes.ok) {
          parsedData = await aiRes.json();
        }
      } catch {
        /* AI parsing failed, continue with manual storage */
      }

      const [doc] = await db
        .insert(iepDocuments)
        .values({
          learnerId: body.learnerId,
          fileName: body.fileName || "pasted-iep-text",
          parsedData: parsedData || { raw_text: body.documentText.substring(0, 5000) },
          status: parsedData ? "parsed" : "uploaded",
        })
        .returning();

      if (parsedData) {
        const goals = (parsedData.goals || []).map((g: any) => ({
          text: g.description || g.text || "",
          domain: g.domain || "other",
          // DAPE sub-domain (locomotor, fine_motor, motor_planning, midline_crossing, etc.).
          subDomain: g.sub_domain || g.subDomain || null,
          baseline: g.baseline || "",
          targetCriteria: g.measurable_criteria || g.target || "",
        }));

        const [profile] = await db
          .insert(iepProfiles)
          .values({
            learnerId: body.learnerId,
            disabilityCategories: parsedData.disability_categories || [],
            accommodations: parsedData.accommodations || [],
            goals,
            recommendedFunctioningLevel: parsedData.recommended_functioning_level,
          })
          .returning();

        for (const goal of goals) {
          // Persist DAPE sub_domain (locomotor, fine_motor, midline_crossing,
          // motor_planning, etc.) as a composite domain string so downstream
          // consumers can route the goal to the DAPE track without a
          // schema migration: e.g. "motor:locomotor".
          const composedDomain = goal.subDomain
            ? `${goal.domain || "motor"}:${goal.subDomain}`
            : goal.domain;
          await db.insert(iepGoals).values({
            learnerId: body.learnerId,
            iepProfileId: profile.id,
            goalText: goal.text,
            domain: composedDomain,
            baseline: goal.baseline,
            targetCriteria: goal.targetCriteria,
          });
        }

        if (parsedData.recommended_functioning_level) {
          await db
            .update(learners)
            .set({ functioningLevel: parsedData.recommended_functioning_level })
            .where(eq(learners.id, body.learnerId));

          await db.insert(learnerFunctioningLevels).values({
            learnerId: body.learnerId,
            level: parsedData.recommended_functioning_level,
            determinedBy: "ai_iep_parse",
            iepSignals: {
              disabilityCategories: parsedData.disability_categories,
              accommodations: parsedData.accommodations,
              model: parsedData.model,
            },
            confidence: 85,
          });
        }

        return { document: doc, profile, parsed: true, summary: parsedData.summary };
      }

      return { document: doc, parsed: false };
    },
  );

  app.get(
    "/api/iep/learner/:learnerId",
    {
      schema: { tags: ["IEP"], security: [{ bearerAuth: [] }] },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const { learnerId } = req.params as any;

      const profiles = await db
        .select()
        .from(iepProfiles)
        .where(eq(iepProfiles.learnerId, learnerId));
      const goals = await db.select().from(iepGoals).where(eq(iepGoals.learnerId, learnerId));
      const documents = await db
        .select()
        .from(iepDocuments)
        .where(eq(iepDocuments.learnerId, learnerId));

      return { profiles, goals, documents };
    },
  );

  /**
   * IEP packet generation (§9.3 Greenfield 6–8w).
   *
   * GET /api/iep/learner/:learnerId/packet[?format=md|html|json]
   *
   * Loads the learner, the most recent IEP profile, and all goals for the
   * learner; assembles them into a 7-section IEP packet via the pure
   * `buildIepPacket` builder; and returns the requested format.
   *
   * `format=json` is the default — it returns `{ markdown, html, sections }`
   * so the admin UI can render either side-by-side. `format=md` returns
   * raw markdown with `Content-Type: text/markdown`. `format=html` returns
   * a standalone html document for printing / PDF export.
   */
  app.get(
    "/api/iep/learner/:learnerId/packet",
    {
      schema: {
        tags: ["IEP"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["json", "md", "html"], default: "json" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const { learnerId } = req.params as { learnerId: string };
      const { format = "json" } = (req.query as { format?: "json" | "md" | "html" }) ?? {};

      const [learner] = await db.select().from(learners).where(eq(learners.id, learnerId));
      if (!learner) return reply.status(404).send({ error: "Learner not found" });

      const profilesRows = await db
        .select()
        .from(iepProfiles)
        .where(eq(iepProfiles.learnerId, learnerId));
      // Use the most recent profile.
      const profile =
        profilesRows.sort((a: any, b: any) =>
          String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
        )[0] ?? {};

      const goals = await db.select().from(iepGoals).where(eq(iepGoals.learnerId, learnerId));

      const [fl] = await db
        .select()
        .from(learnerFunctioningLevels)
        .where(eq(learnerFunctioningLevels.learnerId, learnerId));

      const { buildIepPacket } = await import("../services/iep-packet.js");
      const packet = buildIepPacket({
        learner: {
          id: learner.id,
          fullName:
            (learner as any).fullName ??
            (`${(learner as any).firstName ?? ""} ${(learner as any).lastName ?? ""}`.trim() ||
              learner.id),
          dateOfBirth: (learner as any).dateOfBirth ?? undefined,
          gradeBand: (learner as any).gradeBand ?? undefined,
          studentId: (learner as any).studentId ?? undefined,
          schoolName: (learner as any).schoolName ?? undefined,
          functioningLevel: fl ? (fl as any).level : undefined,
        },
        profile: {
          presentLevels: (profile as any).presentLevels ?? undefined,
          accommodations: (profile as any).accommodations ?? undefined,
          modifications: (profile as any).modifications ?? undefined,
          assessmentAccommodations: (profile as any).assessmentAccommodations ?? undefined,
          services: (profile as any).services ?? undefined,
          participation: (profile as any).participation ?? undefined,
          effectiveAt: (profile as any).effectiveAt ?? undefined,
          nextReviewAt: (profile as any).nextReviewAt ?? undefined,
        },
        goals: goals.map((g: any) => ({
          id: String(g.id),
          statement: g.statement ?? g.text ?? "",
          alignment: g.alignment ?? g.skillId ?? undefined,
          benchmarks: g.benchmarks ?? undefined,
          progressNote: g.progressNote ?? undefined,
          domain: g.domain ?? undefined,
        })),
        meta: {
          preparedAt: new Date().toISOString(),
        },
      });

      if (format === "md") {
        reply.type("text/markdown; charset=utf-8");
        return packet.markdown;
      }
      if (format === "html") {
        reply.type("text/html; charset=utf-8");
        return packet.html;
      }
      return { learnerId, packet };
    },
  );

  /**
   * IEP PDF intake — `POST /api/iep/upload-pdf` (multipart/form-data).
   *
   * Parents and SPED leads can upload a learner's existing IEP as a PDF.
   * The handler:
   *   1. Reads the multipart upload (≤ 10 MB, see multipart registration
   *      in `src/index.ts`).
   *   2. Extracts the document text via `pdf-parse` (pure-JS, no native
   *      dependency).
   *   3. Forwards the extracted text to the existing
   *      `ai-svc /api/ai/parse-iep` LLM-extraction endpoint.
   *   4. Persists the document, profile, goals, and recommended
   *      functioning level via the same flow used by `POST /api/iep/parse`.
   *
   * Form fields:
   *   - `file`           — the PDF file (required).
   *   - `learnerId`      — the learner the IEP belongs to (required).
   *   - `fileName`       — optional override for the stored file name;
   *                        falls back to the multipart filename.
   *
   * Returns the same `{ document, profile?, parsed, summary? }` shape as
   * `/api/iep/parse` so the parent-portal upload UI has a single response
   * contract regardless of whether text was pasted or a PDF was uploaded.
   */
  app.post(
    "/api/iep/upload-pdf",
    {
      schema: {
        tags: ["IEP"],
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;

      if (!(req as any).isMultipart || !(req as any).isMultipart()) {
        return reply.status(400).send({ error: "Expected multipart/form-data." });
      }

      let learnerId: string | undefined;
      let fileNameOverride: string | undefined;
      let fileName: string | undefined;
      let fileBuffer: Buffer | undefined;
      let fileMimetype: string | undefined;

      try {
        // Iterate parts so file + learnerId can arrive in any order. The
        // multipart plugin enforces files=1 + 10 MB cap registered at boot.
        for await (const part of (req as any).parts()) {
          if (part.type === "file") {
            fileName = part.filename;
            fileMimetype = part.mimetype;
            try {
              fileBuffer = await part.toBuffer();
            } catch (err: any) {
              if (err?.code === "FST_REQ_FILE_TOO_LARGE" || err?.code === "FST_FILES_LIMIT") {
                return reply.status(413).send({
                  error: "PDF must be at most 10 MB.",
                  code: "file_too_large",
                });
              }
              return reply.status(400).send({ error: "Could not read upload." });
            }
          } else if (part.fieldname === "learnerId") {
            learnerId = String(part.value);
          } else if (part.fieldname === "fileName") {
            fileNameOverride = String(part.value);
          }
        }
      } catch {
        return reply.status(400).send({ error: "Could not read upload." });
      }

      if (!learnerId) {
        return reply.status(400).send({ error: "Missing learnerId field." });
      }
      if (!fileBuffer) {
        return reply.status(400).send({ error: "No file provided." });
      }
      if (fileBuffer.length === 0) {
        return reply.status(400).send({ error: "Empty PDF." });
      }

      // ── Upload hardening (Sprint C-10, Decision D6) ───────────────────────
      // Infra-level AV scanning does NOT exist yet (verified — no ClamAV /
      // gateway scanner in infra/, docker/, helm/, or docs); integrating one is
      // a NAMED FOLLOW-UP. Until then we harden in-code so an obviously-hostile
      // or malformed upload is rejected before it reaches pdf-parse / the LLM:
      //   1. content-type allowlist (the browser-declared MIME);
      //   2. magic-byte sniff — the bytes MUST actually begin with "%PDF-";
      //   3. reject encrypted / active-content (JavaScript / embedded-launch)
      //      PDFs, which are a classic malware-delivery vector and which we
      //      cannot meaningfully parse anyway.
      // This is defense-in-depth, NOT a substitute for AV; see the D6 follow-up.
      const safety = assertPdfSafety(fileBuffer, fileMimetype);
      if (!safety.ok) {
        return reply.status(safety.status).send({ error: safety.error, code: safety.code });
      }

      // Extract the document text. Lazy-import `pdf-parse` from its inner
      // module path so the package's debug-mode top-level test-file load
      // (which scans `./test/data/05-versions-space.pdf`) does not run when
      // assessment-svc imports this route at boot.
      let documentText: string;
      try {
        const pdfParseMod: any = await import("pdf-parse/lib/pdf-parse.js");
        const pdfParse = pdfParseMod.default ?? pdfParseMod;
        const parsed = await pdfParse(fileBuffer);
        documentText = String(parsed?.text ?? "").trim();
      } catch {
        return reply.status(400).send({ error: "Could not parse PDF." });
      }

      if (documentText.length < 50) {
        return reply.status(400).send({
          error:
            "PDF text is too short to be an IEP (need at least 50 characters of extractable text).",
          code: "pdf_text_too_short",
        });
      }

      // Forward the extracted text to the AI extraction endpoint. This is
      // the same path `POST /api/iep/parse` uses for pasted text, so the
      // downstream persistence behaviour is identical.
      let parsedData: any;
      try {
        const aiRes = await fetch(`${AI_SVC_URL}/api/ai/parse-iep`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_text: documentText, learner_name: "" }),
        });
        if (aiRes.ok) {
          parsedData = await aiRes.json();
        }
      } catch {
        /* AI parsing failed; continue and store raw text so a human can review. */
      }

      const storedFileName = fileNameOverride || fileName || "uploaded-iep.pdf";

      const [doc] = await db
        .insert(iepDocuments)
        .values({
          learnerId,
          fileName: storedFileName,
          parsedData: parsedData || { raw_text: documentText.substring(0, 5000) },
          status: parsedData ? "parsed" : "uploaded",
        })
        .returning();

      if (!parsedData) {
        return { document: doc, parsed: false };
      }

      const goals = (parsedData.goals || []).map((g: any) => ({
        text: g.description || g.text || "",
        domain: g.domain || "other",
        subDomain: g.sub_domain || g.subDomain || null,
        baseline: g.baseline || "",
        targetCriteria: g.measurable_criteria || g.target || "",
      }));

      const [profile] = await db
        .insert(iepProfiles)
        .values({
          learnerId,
          disabilityCategories: parsedData.disability_categories || [],
          accommodations: parsedData.accommodations || [],
          goals,
          recommendedFunctioningLevel: parsedData.recommended_functioning_level,
        })
        .returning();

      for (const goal of goals) {
        const composedDomain = goal.subDomain
          ? `${goal.domain || "motor"}:${goal.subDomain}`
          : goal.domain;
        await db.insert(iepGoals).values({
          learnerId,
          iepProfileId: profile.id,
          goalText: goal.text,
          domain: composedDomain,
          baseline: goal.baseline,
          targetCriteria: goal.targetCriteria,
        });
      }

      if (parsedData.recommended_functioning_level) {
        await db
          .update(learners)
          .set({ functioningLevel: parsedData.recommended_functioning_level })
          .where(eq(learners.id, learnerId));

        await db.insert(learnerFunctioningLevels).values({
          learnerId,
          level: parsedData.recommended_functioning_level,
          determinedBy: "ai_iep_pdf_parse",
          iepSignals: {
            disabilityCategories: parsedData.disability_categories,
            accommodations: parsedData.accommodations,
            model: parsedData.model,
          },
          confidence: 85,
        });
      }

      return { document: doc, profile, parsed: true, summary: parsedData.summary };
    },
  );
}
