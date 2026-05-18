import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_USERS } from "@/lib/auth/mock-session";
import { ROLE_LABEL, type Role } from "@/lib/auth/types";

async function mockSignIn(formData: FormData) {
  "use server";
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { ROLE_HOME } = await import("@/lib/auth/types");
  const { MOCK_COOKIE_NAME } = await import("@/lib/auth/mock-session");

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

const ROLES: Role[] = [
  "parent",
  "learner",
  "teacher",
  "school_admin",
  "district_admin",
  "platform_admin",
];

export default function LoginPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12"
    >
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Choose a role to enter the demo. Real authentication arrives in Sprint 2.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={mockSignIn} className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Demo role</legend>
              {ROLES.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-aivo-border bg-aivo-surface p-3 text-sm hover:bg-aivo-surface-2"
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    defaultChecked={r === "parent"}
                    className="h-4 w-4 accent-aivo-primary"
                  />
                  <span className="font-medium">{ROLE_LABEL[r]}</span>
                  <span className="ml-auto text-xs text-aivo-muted">{MOCK_USERS[r].email}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" className="mt-2">
              Continue
            </Button>
          </form>
          <p className="mt-4 text-sm text-aivo-ink-soft">
            New here?{" "}
            <Link href="/signup" className="font-medium text-aivo-primary hover:underline">
              Create an account
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
