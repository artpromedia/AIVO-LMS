import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readMockSessionFromCookies, MOCK_COOKIE_NAME, MOCK_USERS } from "@/lib/auth/mock-session";
import { ROLE_HOME, ROLE_LABEL, type Role } from "@/lib/auth/types";
import { MascotCoach } from "@/components/playful-calm";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { HeroVisual } from "@/components/marketing/hero-visual";

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
      <main id="main" className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-14 lg:pt-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-iw-border bg-white px-4 py-1.5 text-iw-primary shadow-soft-1">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-bold tracking-wide">FERPA &amp; COPPA Compliant</span>
            </div>
            <h1 className="mt-6 font-iw-display text-5xl font-bold leading-[1.05] tracking-tight text-iw-ink sm:text-6xl lg:text-7xl">
              Learning that{" "}
              <span className="relative inline-block">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-1 -z-10 h-[0.55em] rounded-sm bg-iw-warm-soft"
                />
                <span className="relative text-iw-ink">adapts</span>
              </span>{" "}
              to your child.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-iw-ink-muted sm:text-xl">
              AIVO is the first AI learning platform engineered explicitly for neurodiverse
              cognitive profiles. We build a personalised &ldquo;brain-clone&rdquo; that models
              how your K&ndash;8 child learns best.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {session ? (
                <>
                  <Button asChild size="lg">
                    <Link href={ROLE_HOME[session.role]} className="group">
                      Continue as {ROLE_LABEL[session.role]}
                      <ArrowRight
                        className="h-5 w-5 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">Switch role</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/signup" className="group">
                      Start Family Trial
                      <ArrowRight
                        className="h-5 w-5 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/admin/district">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                      For School Districts
                    </Link>
                  </Button>
                </>
              )}
            </div>
            <div className="mt-8 flex items-center gap-3">
              <div
                aria-hidden="true"
                className="flex -space-x-2"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-iw-bg bg-iw-accent-soft text-xs font-bold text-iw-primary">
                  S
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-iw-bg bg-iw-warm-soft text-xs font-bold text-iw-warm">
                  M
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-iw-bg bg-iw-accent text-xs font-bold text-iw-primary-fg">
                  J
                </span>
              </div>
              <p className="text-sm font-semibold text-iw-ink-muted">
                Trusted by 1,200+ specialists and parents.
              </p>
            </div>
          </div>

          <div className="hidden lg:block">
            <HeroVisual />
          </div>
        </section>
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
