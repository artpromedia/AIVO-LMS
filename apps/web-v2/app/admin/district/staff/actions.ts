"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePageRole } from "@/lib/auth/server";
import { scopeTenantsForSession } from "@/lib/db/repos";
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  identityCreateAdminInvite,
  identityRevokeAdminInvite,
  identityInviteTeacher,
} from "@/lib/auth/identity-client";
import { createStaffInvite, revokeStaffInvite, type StaffRole } from "@/lib/db/staff-invites";

const ROLES: readonly StaffRole[] = ["district_admin", "school_admin", "teacher"];

function asStaffRole(value: unknown): StaffRole | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as StaffRole)
    : null;
}

export type StaffInviteFormState =
  | { status: "idle" }
  | { status: "error"; error: string }
  // Real-auth: the invite was emailed; the invitee sets their own password.
  | { status: "invited"; email: string; displayName: string }
  // Demo fallback: in-memory invite with a temporary password to share.
  | {
      status: "success";
      email: string;
      temporaryPassword: string;
      displayName: string;
    };

export const initialStaffInviteState: StaffInviteFormState = { status: "idle" };

async function readAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
}

function realError(status: number, error: string): string {
  if (status === 401) return "Your session has expired. Sign in again to invite staff.";
  return error;
}

export async function inviteStaffAction(
  _prev: StaffInviteFormState,
  formData: FormData,
): Promise<StaffInviteFormState> {
  const session = await requirePageRole(["district_admin", "platform_admin"]);

  const role = asStaffRole(formData.get("role"));
  if (!role) return { status: "error", error: "Pick a role." };

  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim() || null;

  if (!email || !displayName) {
    return { status: "error", error: "Enter the staff member's name and email." };
  }
  if (role !== "district_admin" && !schoolId) {
    return { status: "error", error: "Pick a school for this staff member." };
  }

  const accessToken = await readAccessToken();

  // --- Real-auth path: persist + email via identity-svc. ----------
  if (accessToken) {
    if (role === "district_admin") {
      const r = await identityCreateAdminInvite(accessToken, {
        email,
        name: displayName,
        role: "DISTRICT_ADMIN",
      });
      if (!r.ok) return { status: "error", error: realError(r.status, r.error) };
    } else if (role === "school_admin") {
      const r = await identityCreateAdminInvite(accessToken, {
        email,
        name: displayName,
        role: "SCHOOL_ADMIN",
        schoolId: schoolId!,
      });
      if (!r.ok) return { status: "error", error: realError(r.status, r.error) };
    } else {
      const r = await identityInviteTeacher(accessToken, {
        email,
        name: displayName,
        schoolId: schoolId!,
      });
      if (!r.ok) return { status: "error", error: realError(r.status, r.error) };
    }
    revalidatePath("/admin/district/staff");
    return { status: "invited", email, displayName };
  }

  // --- Demo fallback: in-memory store, temp password. -------------
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((tn) => tn.id);
  const targetTenant = role === "district_admin" ? session.tenantId : schoolId;
  if (!targetTenant || !tenantIds.includes(targetTenant)) {
    return { status: "error", error: "Pick a valid school for this staff member." };
  }
  const result = createStaffInvite({
    tenantId: targetTenant,
    schoolId: role === "district_admin" ? null : targetTenant,
    email,
    role,
    displayName,
    invitedBy: session.userId,
  });
  if (!result.ok) return { status: "error", error: result.error };

  revalidatePath("/admin/district/staff");
  return {
    status: "success",
    email: result.record.email,
    temporaryPassword: result.record.temporaryPassword,
    displayName: result.record.displayName,
  };
}

export async function revokeStaffInviteAction(formData: FormData): Promise<void> {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) return;

  const accessToken = await readAccessToken();
  if (accessToken) {
    await identityRevokeAdminInvite(accessToken, inviteId);
    revalidatePath("/admin/district/staff");
    return;
  }

  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  revokeStaffInvite(
    inviteId,
    tenants.map((tn) => tn.id),
  );
  revalidatePath("/admin/district/staff");
}
