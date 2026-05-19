import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WelcomePanel } from "@/components/auth/welcome-panel";

const IS_DEMO = process.env.NEXT_PUBLIC_AUTH_MODE !== "production";

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16 lg:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
          <WelcomePanel
            eyebrow="Start your family trial"
            title="A warmer way to learn — for every child in the family."
            body="Set up learners in minutes. Adaptive AI tutors, sensory-friendly modes, and progress every parent can see."
          />

          <Card variant="hero" className="self-center">
            <CardHeader>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>
                Already have one?{" "}
                <Link href="/login" className="font-semibold text-iw-primary hover:underline">
                  Sign in
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="Riley Parent"
                    required
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    disabled
                  />
                  <p className="mt-1.5 text-xs text-iw-ink-muted">
                    At least 8 characters with a number and a symbol.
                  </p>
                </div>
                <Button type="submit" size="lg" disabled>
                  Create account (coming soon)
                </Button>
              </form>

              {IS_DEMO ? (
                <p className="mt-4 text-xs text-iw-ink-muted">
                  Want to explore first? Use{" "}
                  <Link href="/login" className="font-semibold text-iw-primary hover:underline">
                    sign in
                  </Link>{" "}
                  to enter any demo role.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
