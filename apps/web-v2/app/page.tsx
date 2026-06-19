import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/types";

/**
 * App root.
 *
 * The web app no longer has its own marketing landing page — public marketing
 * lives on the standalone marketing site (apps/marketing). Per the new design,
 * visiting the app root sends a signed-in user straight to their role home and
 * everyone else to the login page (no landing in between).
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_HOME[session.role] ?? "/login");
  }
  redirect("/login");
}
