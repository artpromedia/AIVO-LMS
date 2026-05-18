import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12"
    >
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Sign-up is wired to the design but disabled until Sprint 2 connects real auth. Use{" "}
            <Link href="/login" className="font-medium text-aivo-primary hover:underline">
              sign in
            </Link>{" "}
            to explore the demo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" aria-disabled>
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" placeholder="Riley Parent" disabled />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" placeholder="you@example.com" disabled />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" name="password" disabled />
            </div>
            <Button type="submit" disabled>
              Create account (coming soon)
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
