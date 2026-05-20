import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Banner } from "@/components/ui/banner";
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

/**
 * Role surface inventory. Split into `primary` and `secondary` so the page
 * stops treating "Parent" and "Platform admin" as equally likely entry
 * points. Real-world weight is Parent + Learner ≫ everything else; the
 * UI now reflects that.
 */
const PRIMARY_ROLES: { role: Role; title: string; body: string }[] = [
  {
    role: "parent",
    title: "Parents",
    body: "Set up learners, review readiness, follow growth.",
  },
  {
    role: "learner",
    title: "Learners",
    body: "Today's mission, your tutor, your streak.",
  },
];

const SECONDARY_ROLES: { role: Role; title: string }[] = [
  { role: "teacher", title: "Teacher" },
  { role: "school_admin", title: "School admin" },
  { role: "district_admin", title: "District admin" },
  { role: "platform_admin", title: "Platform admin" },
];

export default async function Home() {
  const session = await readMockSessionFromCookies();

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-6 pb-16 pt-6 sm:pt-10">
        {/* Demo-mode advisory. Replaces the previous unstyled banner that
            looked like a browser security warning. */}
        <Banner
          tone="demo"
          className="mb-10"
          title="You're in demo mode."
          description="Pick any role to explore. Production identity provider arrives in Sprint 2 — real authentication is not yet enabled on this surface."
        />

        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-iw-border bg-iw-card px-4 py-1.5 text-iw-primary shadow-soft-1">
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
            {/* Quiet social-proof line. The previous decorative monogram
                cluster (S / M / J pills) competed with the CTAs for
                attention without conveying meaningful information. */}
            <p className="mt-8 text-sm text-iw-ink-muted">
              Trusted by 1,200+ specialists and parents.
            </p>
          </div>

          <div className="hidden lg:block">
            <HeroVisual />
          </div>
        </section>
        <MascotCoach
          name="Your tutor companion"
          tip="One primary action per screen helps young learners stay focused."
        />

        {/* Primary roles — Parent + Learner. Weighted as the realistic
            entry points. */}
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
              : "Pick a role to enter the demo. Most visitors start as a parent or learner."}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PRIMARY_ROLES.map((card) => {
              const isActive = session?.role === card.role;
              return (
                <Card
                  key={card.role}
                  variant={isActive ? "elevated" : "flat"}
                  className="flex flex-col gap-3 p-6"
                  aria-current={isActive ? "true" : undefined}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-iw-display text-xl font-semibold text-iw-ink">
                      {card.title}
                    </h3>
                    {isActive && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-iw-accent-soft px-2.5 py-0.5 text-xs font-semibold text-iw-primary">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-iw-ink-muted">{card.body}</p>
                  <form action={switchRoleAction} className="mt-2">
                    <input type="hidden" name="role" value={card.role} />
                    <Button
                      type="submit"
                      variant={isActive ? "default" : "outline"}
                      size="md"
                      className="w-full sm:w-auto"
                    >
                      {isActive
                        ? `Open ${card.title.toLowerCase()}`
                        : `Enter as ${card.title.toLowerCase()}`}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </form>
                </Card>
              );
            })}
          </div>

          {/* Secondary roles — staff & admin. Compact row, less visual
              weight. Same affordance, lower density. */}
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
              Other roles
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SECONDARY_ROLES.map((card) => {
                const isActive = session?.role === card.role;
                return (
                  <form key={card.role} action={switchRoleAction}>
                    <input type="hidden" name="role" value={card.role} />
                    <Button
                      type="submit"
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      aria-current={isActive ? "true" : undefined}
                    >
                      {card.title}
                      {isActive && (
                        <span className="ml-1 text-xs opacity-70">(you)</span>
                      )}
                    </Button>
                  </form>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
