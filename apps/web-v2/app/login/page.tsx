import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOCK_USERS } from "@/lib/auth/mock-session";
import type { Role } from "@/lib/auth/types";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WelcomePanel } from "@/components/auth/welcome-panel";
import { DemoRolePicker } from "@/components/auth/demo-role-picker";

const IS_DEMO = process.env.NEXT_PUBLIC_AUTH_MODE !== "production";

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
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
          <WelcomePanel
            eyebrow="Welcome back"
            title="Pick up where every learner left off."
            body="Sign in to continue your personalised AIVO journey — tutors, missions, and progress all in one place."
          />

          <Card variant="hero" className="self-center">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Use your AIVO account to access tutors, missions, and family insights.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    disabled={IS_DEMO}
                  />
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-iw-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={IS_DEMO}
                  />
                </div>
                <Button type="submit" size="lg" disabled={IS_DEMO}>
                  {IS_DEMO ? "Sign in (coming soon)" : "Sign in"}
                </Button>
              </form>

              <p className="mt-4 text-sm text-iw-ink-muted">
                New here?{" "}
                <Link href="/signup" className="font-semibold text-iw-primary hover:underline">
                  Create an account
                </Link>
                .
              </p>

              {IS_DEMO ? <DemoRolePicker action={mockSignIn} /> : null}
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
