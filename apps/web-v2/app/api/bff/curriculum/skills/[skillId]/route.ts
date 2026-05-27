import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  addSkillPrerequisite,
  getCurrentSkillVersion,
  getSkill,
  listAssessmentBlueprints,
  listCurriculumMaps,
  listLessonObjectiveTemplates,
  listSkillPrerequisites,
  listSkillVersions,
  updateSkill,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ skillId: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  gradeBand: z.string().min(1).max(20).optional(),
  addPrerequisite: z
    .object({
      prerequisiteSkillId: z.string().min(1),
      strength: z.enum(["hard", "soft"]),
      notes: z.string().max(500).nullable().optional(),
    })
    .optional(),
});

const READ_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { skillId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...READ_ROLES], requestId);
    if (roleErr) return roleErr;
    const skill = await getSkill(skillId);
    if (!skill) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Skill not found." }, requestId);
    }
    return ok(
      {
        skill,
        currentVersion: getCurrentSkillVersion(skillId),
        versions: listSkillVersions(skillId),
        prereqEdges: listSkillPrerequisites(skillId),
        objectiveTemplates: listLessonObjectiveTemplates(skillId),
        assessmentBlueprints: listAssessmentBlueprints(skillId),
        curriculumMaps: listCurriculumMaps(skillId),
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { skillId } = await params;
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    let updated = updateSkill(skillId, {
      name: parsed.data.name,
      gradeBand: parsed.data.gradeBand,
    });
    if (!updated) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Skill not found." }, requestId);
    }
    let prereqResult: "ok" | "cycle" | "missing" | null = null;
    if (parsed.data.addPrerequisite) {
      const added = addSkillPrerequisite({
        skillId,
        prerequisiteSkillId: parsed.data.addPrerequisite.prerequisiteSkillId,
        strength: parsed.data.addPrerequisite.strength,
        notes: parsed.data.addPrerequisite.notes ?? null,
      });
      prereqResult = added ? "ok" : "cycle";
      if (added) updated = await getSkill(skillId) ?? updated;
      else {
        return fail(
          {
            ...ERRORS.VALIDATION_FAILED,
            message: "Prerequisite would create a cycle or references an unknown skill.",
          },
          requestId,
        );
      }
    }
    audit(session!, "curriculum.skill.updated", requestId, {
      metadata: { skillId, prereqResult },
    });
    return ok({ skill: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
