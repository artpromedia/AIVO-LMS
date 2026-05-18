import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createSubject, listDomains, listSubjects, listSkills } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const slugRe = /^[a-z][a-z0-9-]*$/;
const bodySchema = z.object({
  slug: z.string().min(1).max(64).regex(slugRe, "slug must be lowercase kebab-case"),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  iconKey: z.string().min(1).max(50),
});

const READ_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...READ_ROLES], requestId);
    if (roleErr) return roleErr;
    const subjects = listSubjects();
    const skillCounts = new Map<string, number>();
    for (const s of listSkills()) {
      skillCounts.set(s.subjectId, (skillCounts.get(s.subjectId) ?? 0) + 1);
    }
    return ok(
      {
        subjects: subjects.map((s) => ({
          ...s,
          domains: listDomains(s.id),
          skillCount: skillCounts.get(s.id) ?? 0,
        })),
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    if (listSubjects().some((s) => s.slug === parsed.data.slug)) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Subject slug already exists." },
        requestId,
      );
    }
    const rec = createSubject(parsed.data);
    audit(session!, "curriculum.subject.created", requestId, {
      metadata: { subjectId: rec.id, slug: rec.slug },
    });
    return ok({ subject: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
