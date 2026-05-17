import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  createStandardsFramework,
  getStandardsFrameworkBySlug,
  listStandardDocuments,
  listStandardsFrameworks,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const FRAMEWORK_SLUGS = [
  "common-core-math",
  "common-core-ela",
  "ngss-science",
  "state-placeholder",
  "aivo-extensions",
] as const;

const bodySchema = z.object({
  slug: z.enum(FRAMEWORK_SLUGS),
  name: z.string().min(1).max(200),
  issuer: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  homepageUrl: z.string().url().nullable().optional(),
});

const READ_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...READ_ROLES], requestId);
    if (roleErr) return roleErr;
    const frameworks = listStandardsFrameworks();
    const docs = listStandardDocuments();
    const docsByFramework = new Map<string, number>();
    for (const d of docs) {
      docsByFramework.set(d.frameworkId, (docsByFramework.get(d.frameworkId) ?? 0) + 1);
    }
    return ok(
      {
        frameworks: frameworks.map((f) => ({
          ...f,
          documentCount: docsByFramework.get(f.id) ?? 0,
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
    // Mutations are platform_admin only — curriculum is a global catalog.
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
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." },
        requestId,
      );
    }
    if (getStandardsFrameworkBySlug(parsed.data.slug)) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Framework slug already exists." },
        requestId,
      );
    }
    const rec = createStandardsFramework({
      slug: parsed.data.slug,
      name: parsed.data.name,
      issuer: parsed.data.issuer,
      description: parsed.data.description,
      homepageUrl: parsed.data.homepageUrl ?? null,
    });
    audit(session!, "curriculum.framework.created", requestId, {
      metadata: { frameworkId: rec.id, slug: rec.slug },
    });
    return ok({ framework: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
