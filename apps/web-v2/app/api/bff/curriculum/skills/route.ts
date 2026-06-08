import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  createSkill,
  getCurrentSkillVersion,
  listAssessmentBlueprints,
  listCurriculumMaps,
  listLessonObjectiveTemplates,
  listSkillPrerequisites,
  listSkills,
  listSubjects,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const slugRe = /^[a-z][a-z0-9-]*$/;
const bodySchema = z.object({
  subjectId: z.string().min(1),
  slug: z.string().min(1).max(64).regex(slugRe),
  name: z.string().min(1).max(200),
  gradeBand: z.string().min(1).max(20),
  prerequisites: z.array(z.string()).max(20).optional(),
});

const READ_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...READ_ROLES], requestId);
    if (roleErr) return roleErr;
    const url = new URL(req.url);
    const subjectId = url.searchParams.get("subjectId") ?? undefined;
    const skills = await listSkills(subjectId);
    const enriched = await Promise.all(
      skills.map(async (s) => ({
        ...s,
        currentVersion: await getCurrentSkillVersion(s.id),
        prereqEdges: await listSkillPrerequisites(s.id),
        hasObjectiveTemplate: (await listLessonObjectiveTemplates(s.id)).length > 0,
        hasAssessmentBlueprint: (await listAssessmentBlueprints(s.id)).length > 0,
        mappedStandards: (await listCurriculumMaps(s.id)).length,
      })),
    );
    return ok({ skills: enriched }, requestId);
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
    const subjectsForCheck = await listSubjects();
    if (!subjectsForCheck.some((s) => s.id === parsed.data.subjectId)) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "subjectId not found." }, requestId);
    }
    const skillsForCheck = await listSkills();
    if (skillsForCheck.some((s) => s.slug === parsed.data.slug)) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Skill slug already exists." },
        requestId,
      );
    }
    const rec = await createSkill(parsed.data);
    audit(session!, "curriculum.skill.created", requestId, {
      metadata: { skillId: rec.id, slug: rec.slug },
    });
    return ok({ skill: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
