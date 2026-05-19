import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readMockSessionFromCookies, MOCK_COOKIE_NAME, MOCK_USERS } from "@/lib/auth/mock-session";
import { ROLE_HOME, ROLE_LABEL, type Role } from "@/lib/auth/types";
import { MascotCoach } from "@/components/playful-calm";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

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
  {
    role: "school_admin",
    title: "School admin",
    body: "Manage staff, classes, and school-level reporting.",
  },
  {
    role: "district_admin",
    title: "District admin",
    body: "Cross-school oversight and rostering.",
  },
  { role: "platform_admin", title: "Platform", body: "Tenant operations and system health." },
];

export default async function Home() {
  const session = await readMockSessionFromCookies();

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-12 rounded-iw-hero border border-iw-border bg-iw-hero p-8 shadow-soft-3 sm:p-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-iw-border bg-iw-accent-soft px-3.5 py-1.5 text-iw-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wide">
              COPPA · FERPA · SOC 2 Compliant
            </span>
          </div>
          <h1 className="mt-5 font-iw-display text-5xl font-bold leading-[1.05] tracking-tight text-iw-ink sm:text-6xl lg:text-7xl">
            Learning that{" "}
            <span className="bg-iw-sensory-brand bg-clip-text text-transparent">adapts</span> to
            every child.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-iw-ink-muted sm:text-xl">
            A warmer, more personal way to learn — with AI tutors that adapt to how each learner
            thinks, focuses, and grows.
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
                  <Link href="/signup">Start Family Trial</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/admin/district">For School Districts</Link>
                </Button>
              </>
            )}
          </div>
        </header>
        <MascotCoach
          name="Your tutor companion"
          tip="One primary action per screen helps young learners stay focused."
        />

        <section id="roles" aria-labelledby="roles-heading" className="mt-16 scroll-mt-24">
          <h2
            id="roles-heading"
            className="font-iw-display text-3xl font-bold tracking-tight text-iw-ink"
          >
            Choose your space
          </h2>
          <p className="mt-2 text-iw-ink-muted">
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
                  variant={isActive ? "elevated" : "flat"}
                  className="flex flex-col gap-2 p-5"
                  aria-current={isActive ? "true" : undefined}
                >
                  <h3 className="font-iw-display text-lg font-semibold text-iw-ink">
                    {card.title}
                    {isActive ? (
                      <span className="ml-2 rounded-full bg-iw-accent-soft px-2 py-0.5 align-middle text-xs font-semibold text-iw-primary">
                        You
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-sm text-iw-ink-muted">{card.body}</p>
                  <form action={switchRoleAction} className="mt-2">
                    <input type="hidden" name="role" value={card.role} />
                    <button
                      type="submit"
                      className="text-sm font-semibold text-iw-primary hover:underline focus-visible:underline"
                    >
                      {isActive
                        ? `Open ${card.title.toLowerCase()} →`
                        : `Enter as ${card.title.toLowerCase()} →`}
                    </button>
                  </form>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
