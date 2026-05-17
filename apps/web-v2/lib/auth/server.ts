import { redirect } from "next/navigation";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { ROLE_HOME, type Role, type SessionProfile } from "@/lib/auth/types";

/**
 * Server-component helper: ensures the visitor is signed in with one of the
 * accepted roles. Mismatched roles are bounced to their own home page so a
 * teacher never lands on /parent/home.
 */
export async function requirePageRole(roles: Role[]): Promise<SessionProfile> {
  const session = await readMockSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  if (!roles.includes(session.role)) {
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}
