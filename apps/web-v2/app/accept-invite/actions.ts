"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { ROLE_HOME } from "@/lib/auth/types";
import { acceptAllInvitesForEmail } from "@/lib/db/team-invites";

export type AcceptResult = { ok: true; count: number } | { ok: false; error: string };

export async function acceptInvitesAction(): Promise<AcceptResult> {
  const session = await readMockSessionFromCookies();
  if (!session) {
    return { ok: false, error: "Sign in first to accept invitations." };
  }
  const result = acceptAllInvitesForEmail(session.email, session.userId);
  revalidatePath("/accept-invite");
  return { ok: true, count: result.count };
}

export async function continueToHomeAction(): Promise<void> {
  const session = await readMockSessionFromCookies();
  if (!session) redirect("/login");
  redirect(ROLE_HOME[session.role]);
}
