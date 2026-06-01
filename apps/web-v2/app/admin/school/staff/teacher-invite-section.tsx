"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteTeacherAction, type TeacherInviteState } from "./actions";

export function TeacherInviteSection() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<TeacherInviteState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteTeacherAction(email, name);
      setState(result);
      if (result.status === "invited" || result.status === "invited_demo") {
        setName("");
        setEmail("");
        router.refresh();
      }
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-aivo-accent" />
        <h2 className="text-base font-semibold text-aivo-ink">Invite a teacher</h2>
      </div>
      <p className="text-sm text-aivo-ink-soft">
        The teacher gets an email invitation to join this school and set their own password.
      </p>

      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="teacher-name">Full name</Label>
          <Input
            id="teacher-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Rivera"
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="teacher-email">Email</Label>
          <Input
            id="teacher-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jordan@school.edu"
            required
            disabled={pending}
          />
        </div>
        <Button type="submit" disabled={pending} className="sm:w-auto">
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </span>
          ) : (
            "Send invitation"
          )}
        </Button>
      </form>

      {state.status === "error" ? (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <p className="text-sm text-aivo-ink">{state.error}</p>
        </div>
      ) : null}

      {state.status === "invited" ? (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p className="text-sm text-aivo-ink">
            Invitation emailed to <strong>{state.email}</strong>. They&apos;ll set a password and
            appear here once they accept.
          </p>
        </div>
      ) : null}

      {state.status === "invited_demo" ? (
        <div className="space-y-2 rounded-lg bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <p className="text-sm text-aivo-ink">
              Demo mode: created a placeholder invite for <strong>{state.email}</strong>. Share this
              temporary password out-of-band (real email is sent when identity-svc is configured):
            </p>
          </div>
          <code className="block rounded bg-white px-3 py-2 font-mono text-sm">
            {state.temporaryPassword}
          </code>
        </div>
      ) : null}
    </Card>
  );
}
