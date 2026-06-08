import { z } from "zod";
import { fail, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getSession } from "@/lib/auth/session";
import { getTenantSettings, updateTenantSettings, recordAudit } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const BrandingSchema = z.object({
  displayName: z.string().min(1).max(120).nullable().optional(),
  supportEmail: z.string().email().max(254).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a #RRGGBB hex colour.")
    .nullable()
    .optional(),
});

const NotificationsSchema = z.object({
  weeklyDigestEmail: z.boolean().optional(),
  incidentAlertsEmail: z.boolean().optional(),
  rosterDriftEmail: z.boolean().optional(),
  complianceRemindersEmail: z.boolean().optional(),
});

const FeaturesSchema = z.object({
  homeworkHelpEnabled: z.boolean().optional(),
  parentIepUploadEnabled: z.boolean().optional(),
  rewardsShopEnabled: z.boolean().optional(),
  discoveryAdventureEnabled: z.boolean().optional(),
});

const SSOSchema = z.object({
  mode: z.enum(["off", "saml", "oidc"]).optional(),
  idpName: z.string().max(120).nullable().optional(),
  metadataUrl: z.string().url().max(1000).nullable().optional(),
  scimEnabled: z.boolean().optional(),
  rotateScim: z.boolean().optional(),
});

const PatchSchema = z.object({
  branding: BrandingSchema.optional(),
  notifications: NotificationsSchema.optional(),
  features: FeaturesSchema.optional(),
  sso: SSOSchema.optional(),
});

async function requireDistrictAdmin(req: Request) {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session) {
    return {
      err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId),
    };
  }
  if (session.role !== "district_admin") {
    return {
      err: fail({ ...ERRORS.FORBIDDEN_ROLE, message: "district_admin required" }, requestId),
    };
  }
  return { session, requestId };
}

export async function GET(req: Request) {
  const got = await requireDistrictAdmin(req);
  if ("err" in got) return got.err;
  return ok(await getTenantSettings(got.session.tenantId), got.requestId);
}

export async function PATCH(req: Request) {
  const got = await requireDistrictAdmin(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(
      {
        ...ERRORS.VALIDATION_FAILED,
        message: "Could not read request body.",
      },
      requestId,
    );
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      {
        ...ERRORS.VALIDATION_FAILED,
        message: parsed.error.message,
      },
      requestId,
    );
  }

  // SCIM rotation is a flag; translate into the lastScimRotationAt write.
  let ssoPatch: Parameters<typeof updateTenantSettings>[1]["sso"] | undefined;
  if (parsed.data.sso) {
    const { rotateScim, ...rest } = parsed.data.sso;
    ssoPatch = {
      ...rest,
      ...(rotateScim ? { lastScimRotationAt: new Date().toISOString() } : {}),
    };
  }

  const next = await updateTenantSettings(session.tenantId, {
    branding: parsed.data.branding,
    notifications: parsed.data.notifications,
    features: parsed.data.features,
    sso: ssoPatch,
  });

  await recordAudit({
    userId: session.userId,
    tenantId: session.tenantId,
    learnerId: null,
    action: "district.settings.update",
    metadata: { keys: Object.keys(parsed.data) },
    requestId,
  });

  return ok(next, requestId);
}
