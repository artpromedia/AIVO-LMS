"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePageRole } from "@/lib/auth/server";
import { IDENTITY_ACCESS_TOKEN_COOKIE, identityInviteTeacher } from "@/lib/auth/identity-client";
import { createStaffInvite } from "@/lib/db/staff-invites";

/**
 * Invite a teacher to the school admin's school.
 *
 * Dual-mode (per ADR — real-auth with demo fallback):
 *   - When a real identity-svc access token is present, call
 *     POST /api/school/teachers. identity-svc derives the school from the
 *     SCHOOL_ADMIN token, creates a token-hashed invite, and emails the
 *     teacher a link to set their own password (no temp password).
 *   - Otherwise (demo/mock auth), fall back to the in-memory staff registry
 *     so the console keeps working in local/demo environments. That path
 *     still surfaces a temporary password for out-of-band sharing.
 */
export type TeacherInviteState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "invited"; email: string; name: string }
  | { status: "invited_demo"; email: string; name: string; temporaryPassword: string };

export const initialTeacherInviteState: TeacherInviteState = { status: "idle" };

export async function inviteTeacherAction(
  email: string,
  name: string,
): Promise<TeacherInviteState> {
  const session = await requirePageRole(["school_admin"]);
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  if (!trimmedEmail || !trimmedName) {
    return { status: "error", error: "Enter the teacher's name and email." };
  }

  const jar = await cookies();
  const accessToken = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    const result = await identityInviteTeacher(accessToken, {
      email: trimmedEmail,
      name: trimmedName,
    });
    if (!result.ok) {
      const error =
        result.status === 401
          ? "Your session has expired. Sign in again to invite teachers."
          : result.error;
      return { status: "error", error };
    }
    revalidatePath("/admin/school/staff");
    return { status: "invited", email: trimmedEmail, name: trimmedName };
  }

  // Demo fallback — no real session token available.
  const demo = createStaffInvite({
    tenantId: session.tenantId,
    schoolId: session.tenantId,
    email: trimmedEmail,
    role: "teacher",
    displayName: trimmedName,
    invitedBy: session.userId,
  });
  if (!demo.ok) return { status: "error", error: demo.error };
  revalidatePath("/admin/school/staff");
  return {
    status: "invited_demo",
    email: demo.record.email,
    name: demo.record.displayName,
    temporaryPassword: demo.record.temporaryPassword,
  };
}
