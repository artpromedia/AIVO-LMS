import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { MOCK_COOKIE_NAME, MOCK_USERS } from "@/lib/auth/mock-session";
import { ROLE_HOME, ROLE_LABEL, type Role } from "@/lib/auth/types";

/**
 * Demo-mode role switch invoked by the role cards below. Replaces the cookie
 * with the requested role and redirects to that role's home. In production
 * (real auth) this server action is gone — the role cards link to /login
 * and routing is decided by the IdP claims.
 */
async function switchRoleAction(formData: FormData) {
  "use server";
  const role = String(formData.get("role") || "parent") as Role;
  if (!(role in MOCK_USERS)) {
    redirect("/login?error=invalid_role");
  }
  const jar = await cookies();
  jar.set(MOCK_COOKIE_NAME, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(ROLE_HOME[role]);
}

const ROLE_CARDS: { role: Role; title: string; body: string }[] = [
  { role: "parent", title: "Parents", body: "Set up learners, review readiness, follow growth." },
  { role: "learner", title: "Learners", body: "Today's mission, your tutor, your streak." },
  { role: "teacher", title: "Teachers", body: "Class rosters, assignments, learner progress." },
  { role: "school_admin", title: "School admin", body: "Manage staff, classes, and school-level reporting." },
  { role: "district_admin", title: "District admin", body: "Cross-school oversight and rostering." },
  { role: "platform_admin", title: "Platform", body: "Tenant operations and system health." },
];

export default async function Home() {
  const session = await readMockSessionFromCookies();

  return (
    <main id="main" className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <p className="text-sm font-medium uppercase tracking-wide text-aivo-muted">
          AIVO Learning v2
        </p>
        <h1 className="mt-2 font-display text-5xl font-bold text-aivo-ink">
          Learning adventures, built around your child.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-aivo-ink-soft">
          A calmer, more personal way to learn — with AI tutors that adapt to
          how each learner thinks, focuses, and grows.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {session ? (
            <>
              <Button asChild size="lg">
                <Link href={ROLE_HOME[session.role]}>
                  Continue as {ROLE_LABEL[session.role]}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Switch role</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/signup">Create an account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <section aria-labelledby="roles-heading" className="mt-12">
        <h2 id="roles-heading" className="font-display text-2xl font-semibold">
          Choose your space
        </h2>
        <p className="mt-1 text-aivo-ink-soft">
          {session
            ? `Signed in as ${session.displayName} (${ROLE_LABEL[session.role]}). Pick a role to switch — demo mode only.`
            : "Every role has a dedicated home. Pick one to enter the demo."}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_CARDS.map((card) => {
            const isActive = session?.role === card.role;
            return (
              <Card
                key={card.role}
                className="p-5 flex flex-col gap-2"
                aria-current={isActive ? "true" : undefined}
              >
                <h3 className="font-display text-lg font-semibold">
                  {card.title}
                  {isActive ? (
                    <span className="ml-2 rounded-full bg-aivo-primary-soft px-2 py-0.5 text-xs font-medium text-aivo-primary align-middle">
                      You
                    </span>
                  ) : null}
                </h3>
                <p className="text-sm text-aivo-ink-soft">{card.body}</p>
                <form action={switchRoleAction} className="mt-2">
                  <input type="hidden" name="role" value={card.role} />
                  <button
                    type="submit"
                    className="text-sm font-medium text-aivo-primary hover:underline focus-visible:underline"
                  >
                    {isActive ? `Open ${card.title.toLowerCase()} →` : `Enter as ${card.title.toLowerCase()} →`}
                  </button>
                </form>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
