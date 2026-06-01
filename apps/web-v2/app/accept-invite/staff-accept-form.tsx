"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptStaffInviteAction } from "./staff-actions";

const ROLE_LABEL: Record<string, string> = {
  DISTRICT_ADMIN: "District Administrator",
  SCHOOL_ADMIN: "School Administrator",
  TEACHER: "Teacher",
};

type Props = {
  token: string;
  email: string;
  name: string;
  role: string;
  schoolName: string | null;
  districtName: string | null;
};

export function StaffAcceptForm({ token, email, name, role, schoolName, districtName }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const roleLabel = ROLE_LABEL[role] ?? role;
  const scope = schoolName ?? districtName;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setReasons([]);
    startTransition(async () => {
      const result = await acceptStaffInviteAction(token, password, confirmPassword);
      if (result.ok) {
        router.replace(result.redirectTo);
      } else {
        setError(result.error);
        setReasons(result.reasons ?? []);
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-lg bg-aivo-surface-soft p-3 text-sm">
        <p className="text-aivo-ink">
          Welcome, <strong>{name}</strong>. You&apos;ve been invited as a{" "}
          <strong>{roleLabel}</strong>
          {scope ? (
            <>
              {" "}
              for <strong>{scope}</strong>
            </>
          ) : null}
          .
        </p>
        <p className="mt-1 text-aivo-ink-soft">
          Sign-in email: <strong className="text-aivo-ink">{email}</strong>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Create a password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={pending}
        />
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <div className="text-sm text-aivo-ink">
            <p>{error}</p>
            {reasons.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-aivo-ink-soft">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Setting up your account…
          </span>
        ) : (
          "Accept invitation & sign in"
        )}
      </Button>
    </form>
  );
}
