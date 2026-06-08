"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/types";
import { acceptAllInvitesForEmail } from "@/lib/db/team-invites";

export type AcceptResult = { ok: true; count: number } | { ok: false; error: string };

export async function acceptInvitesAction(): Promise<AcceptResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Sign in first to accept invitations." };
  }
  const result = await acceptAllInvitesForEmail(session.email, session.userId, session.tenantId);
  revalidatePath("/accept-invite");
  return { ok: true, count: result.count };
}

export async function continueToHomeAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(ROLE_HOME[session.role]);
}
