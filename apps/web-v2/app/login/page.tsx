import Link from "next/link";
import { AuthCard, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
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
 * Inclusive-Warm / Playful Calm login surface. Rebuilt on the
 * @aivo/ui/auth primitives so the inputs, CTA, and reassurance tone
 * match the rest of onboarding. The actual server action stays in this
 * server file; only the form fields run on the client via LoginForm.
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
        className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16 lg:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <aside className="flex flex-col gap-5">
            <AuthCard
              icon={<AivoIcon name="aiSparkle" size={32} />}
              eyebrow="Welcome back"
              title="Pick up where every learner left off."
              subtitle="Sign in to continue your personalised AIVO journey — tutors, missions, and progress all in one place."
            >
              <ul className="flex flex-col gap-3 text-sm text-iw-ink">
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-color-aivoPurple-100,#ede9fe)] text-[var(--aivo-sensory-primary,#7c3aed)]"
                  >
                    <AivoIcon name="aiSparkle" size={16} />
                  </span>
                  <span>Personalised tutors that remember where each learner left off.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-color-aivoTeal-100,#ccfbf1)] text-[var(--aivo-color-aivoTeal-700,#0f766e)]"
                  >
                    <AivoIcon name="safetyOk" size={16} />
                  </span>
                  <span>Sensory-friendly modes follow you across devices.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-color-aivoPurple-100,#ede9fe)] text-[var(--aivo-sensory-primary,#7c3aed)]"
                  >
                    <AivoIcon name="curriculum" size={16} />
                  </span>
                  <span>Family insights and IEP-aware progress, always in one place.</span>
                </li>
              </ul>
            </AuthCard>
            <ReassuranceCard
              tone="privacy"
              title="We never sell your data."
              body="Your email is used only to identify your account. Read the privacy notice for more."
              link={{ href: "/onboarding/privacy", label: "Read the privacy notice" }}
            />
          </aside>

          <AuthCard
            icon={<AivoIcon name="aiSparkle" size={32} />}
            eyebrow="Sign in"
            title="Welcome back"
            subtitle="Use your AIVO account to access tutors, missions, and family insights."
            actions={
              <>
                <button
                  type="submit"
                  form="login-form"
                  className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold flex items-center justify-center transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--aivo-sensory-primary,#7c3aed)]"
                >
                  Sign in
                </button>
                <p className="text-sm text-iw-ink-muted text-center">
                  New here?{" "}
                  <Link
                    href="/signup"
                    className="font-semibold text-[var(--aivo-sensory-primary,#7c3aed)] hover:underline"
                  >
                    Create an account
                  </Link>
                  .
                </p>
              </>
            }
          >
            <LoginForm
              id="login-form"
              action={mockSignIn}
            />
          </AuthCard>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
