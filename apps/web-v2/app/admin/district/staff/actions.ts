"use server";

import { revalidatePath } from "next/cache";
import { requirePageRole } from "@/lib/auth/server";
import { scopeTenantsForSession } from "@/lib/db/repos";
import {
  createStaffInvite,
  revokeStaffInvite,
  type StaffRole,
} from "@/lib/db/staff-invites";

const ROLES: readonly StaffRole[] = ["district_admin", "school_admin", "teacher"];

function asStaffRole(value: unknown): StaffRole | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as StaffRole)
    : null;
}

export type StaffInviteFormState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | {
      status: "success";
      email: string;
      temporaryPassword: string;
      displayName: string;
    };

export const initialStaffInviteState: StaffInviteFormState = { status: "idle" };

export async function inviteStaffAction(
  _prev: StaffInviteFormState,
  formData: FormData,
): Promise<StaffInviteFormState> {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);

  const role = asStaffRole(formData.get("role"));
  if (!role) return { status: "error", error: "Pick a role." };

  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim() || null;

  // District admins are scoped to their own district tenant; everyone else
  // must be associated with one of the schools they oversee.
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
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  revokeStaffInvite(
    inviteId,
    tenants.map((t) => t.id),
  );
  revalidatePath("/admin/district/staff");
}
