import { redirect } from "next/navigation";
import { readAdminSessionFromCookies, ROLE_HOME } from "@aivo/admin-auth";

export default async function Page() {
  const session = await readAdminSessionFromCookies();
  if (!session) redirect("/login");
  redirect(ROLE_HOME[session.role]);
}
