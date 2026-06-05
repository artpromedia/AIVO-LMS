import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { Permission } from "@aivo/security";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { enterpriseFlags } from "@/lib/bff/feature-flags";
import { requirePermission, requireSession, requireRole } from "@/lib/bff/guards";
import type { Role } from "@/lib/auth/types";
import {
  getAdminBearer,
  identityCreatePlatformStaff,
  identityListPlatformStaff,
  isIdentitySvcEnabled,
  type PlatformStaffRecord,
} from "@/lib/auth/identity-client";

export const dynamic = "force-dynamic";

const PLATFORM_ROLES = [
  "platform_admin",
  "support",
  "marketing",
  "sales",
  "devops",
  "engineering",
] as const;

const MANAGED_ROLES = ["SUPPORT", "MARKETING", "SALES", "DEVOPS", "ENGINEERING"] as const;

function allowedPlatformRoles(): Role[] {
  return enterpriseFlags.delegatedAdminRbacV2()
    ? [...PLATFORM_ROLES]
    : ["platform_admin"];
}

const demoPlatformStaff = new Map<string, PlatformStaffRecord>(
  [
    {
      id: "demo_support_1",
      tenantId: "t_platform",
      email: "support@demo.aivo",
      name: "Alex Support",
      role: "SUPPORT",
      active: true,
    },
    {
      id: "demo_engineering_1",
      tenantId: "t_platform",
      email: "engineering@demo.aivo",
      name: "Taylor Engineering",
      role: "ENGINEERING",
      active: true,
    },
  ].map((row) => [row.id, row]),
);

function isManagedRole(role: string): role is (typeof MANAGED_ROLES)[number] {
  return (MANAGED_ROLES as readonly string[]).includes(role);
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, allowedPlatformRoles(), requestId);
    if (roleErr) return roleErr;
    const permissionErr = requirePermission(session!, Permission.UserRead, requestId);
    if (permissionErr) return permissionErr;

    const bearer = await getAdminBearer();
    if (isIdentitySvcEnabled() && bearer) {
      const result = await identityListPlatformStaff(bearer.replace(/^Bearer\s+/i, ""));
      if (!result.ok) {
        return fail(
          {
            code: "UPSTREAM_UNAVAILABLE",
            message: result.error,
            userMessage: "Couldn't load platform staff right now.",
            retryable: result.status >= 500,
            status: result.status >= 500 ? 502 : result.status,
          },
          requestId,
        );
      }
      return ok({ staff: result.staff }, requestId);
    }

    return ok({ staff: [...demoPlatformStaff.values()] }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, allowedPlatformRoles(), requestId);
    if (roleErr) return roleErr;
    const permissionErr = requirePermission(session!, Permission.StaffProvision, requestId);
    if (permissionErr) return permissionErr;

    const body = (await req.json().catch(() => null)) as {
      email?: string;
      name?: string;
      role?: string;
    } | null;
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const role = String(body?.role || "").trim().toUpperCase();

    if (!email || !name || !role) {
      return fail(
        {
          code: "VALIDATION_FAILED",
          message: "email, name, and role are required",
          userMessage: "Please fill in name, email, and role.",
          status: 400,
        },
        requestId,
      );
    }
    if (!isManagedRole(role)) {
      return fail(
        {
          code: "VALIDATION_FAILED",
          message: `role must be one of ${MANAGED_ROLES.join(", ")}`,
          userMessage: "Choose a valid platform staff role.",
          status: 400,
        },
        requestId,
      );
    }

    const bearer = await getAdminBearer();
    if (isIdentitySvcEnabled() && bearer) {
      const result = await identityCreatePlatformStaff(bearer.replace(/^Bearer\s+/i, ""), {
        email,
        name,
        role,
      });
      if (!result.ok) {
        return fail(
          {
            code: result.status === 409 ? "CONFLICT" : "UPSTREAM_UNAVAILABLE",
            message: result.error,
            userMessage:
              result.status === 409
                ? "That email is already in use."
                : "Couldn't create the staff account right now.",
            retryable: result.status >= 500,
            status: result.status >= 500 ? 502 : result.status,
          },
          requestId,
        );
      }
      return ok(
        { user: result.user, tempPassword: result.tempPassword ?? null },
        requestId,
        { status: 201 },
      );
    }

    const id = crypto.randomUUID();
    const record: PlatformStaffRecord = {
      id,
      tenantId: session!.tenantId,
      email,
      name,
      role,
      active: true,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    demoPlatformStaff.set(id, record);
    return ok(
      { user: record, tempPassword: "demo-temp-password" },
      requestId,
      { status: 201 },
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
