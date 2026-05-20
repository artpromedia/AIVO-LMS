import Link from "next/link";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { MOCK_USERS } from "@/lib/auth/mock-session";
import type { Role } from "@/lib/auth/types";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { LoginForm } from "./_components/login-form";

async function mockSignIn(formData: FormData) {
  "use server";
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { ROLE_HOME } = await import("@/lib/auth/types");
  const { MOCK_COOKIE_NAME } = await import("@/lib/auth/mock-session");

  const raw = formData.get("role");
  const role = (typeof raw === "string" ? raw : "parent") as Role;
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
 * Login surface — parent / educator entry into AIVO.
 *
 * Layout intent (post-Day-6 redesign):
 *
 *   < lg : single-column. Wordmark header above one form card. No bullet
 *          list, no reassurance card, no secondary chrome — the user is
 *          here to sign in, not be re-sold the product.
 *
 *   ≥ lg : two columns weighted toward the form. The left column is a
 *          quiet brand-presence strip (mark + a single line of context +
 *          a single decorative dot). It establishes "you're on AIVO"
 *          without competing with the form.
 *
 * No inline hex. No raw `<button>`. All interactive colors flow through
 * `iw-*` Tailwind utilities so the sensory-mode toggle repaints the
 * surface without re-wiring.
 */
export default function LoginPage({
  searchParams: _searchParams,
}: {
  readonly searchParams: Promise<{ error?: string }>;
}) {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14 lg:py-20"
      >
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          {/* Brand-presence strip — desktop only. Intentionally quiet. */}
          <aside className="hidden lg:flex flex-col gap-6 max-w-md">
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
            >
              <AivoIcon name="aiSparkle" size={28} />
            </span>
            <h2 className="font-iw-display text-3xl font-bold leading-[1.1] text-iw-ink">
              Sign in to continue your AIVO journey.
            </h2>
            <p className="text-base leading-relaxed text-iw-ink-muted">
              Your tutors, missions, and family insights — all in one place,
              tuned for how your learner thinks.
            </p>
          </aside>

          {/* Form card — dominant on every breakpoint. */}
          <div className="flex flex-col gap-4">
            {/* Mobile-only header — replaces the desktop brand-presence strip. */}
            <div className="lg:hidden flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
              >
                <AivoIcon name="aiSparkle" size={22} />
              </span>
              <h2 className="font-iw-display text-2xl font-bold leading-tight text-iw-ink">
                Welcome back.
              </h2>
            </div>

            <AuthCard
              eyebrow="Sign in"
              title="Continue with your AIVO account"
              subtitle="Email and password. Single sign-on coming soon."
              actions={
                <>
                  <Button
                    type="submit"
                    form="login-form"
                    variant="default"
                    size="lg"
                    className="w-full"
                  >
                    Sign in
                  </Button>
                  <p className="text-sm text-iw-ink-muted text-center">
                    New here?{" "}
                    <Link
                      href="/signup"
                      className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                    >
                      Create an account
                    </Link>
                    .
                  </p>
                </>
              }
            >
              <LoginForm id="login-form" action={mockSignIn} />
            </AuthCard>

            {/* Single-line privacy reassurance. Replaces the previous
                ReassuranceCard so the screen has one visual focus, not two. */}
            <p className="text-xs text-iw-ink-muted text-center">
              We never sell your data.{" "}
              <Link
                href="/onboarding/privacy"
                className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
              >
                Read the privacy notice
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
