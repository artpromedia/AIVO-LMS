"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type PlatformStaffRecord = {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: string;
  active: boolean;
  mustChangePassword?: boolean;
  deactivatedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
};

const ROLE_OPTIONS = [
  { value: "SUPPORT", label: "Support" },
  { value: "MARKETING", label: "Marketing" },
  { value: "SALES", label: "Sales" },
  { value: "DEVOPS", label: "DevOps" },
  { value: "ENGINEERING", label: "Engineering" },
] as const;

export function PlatformStaffConsole({ canProvision }: { canProvision: boolean }) {
  const [staff, setStaff] = useState<PlatformStaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]["value"]>("SUPPORT");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    fetch("/api/bff/admin/staff", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          data?: { staff?: PlatformStaffRecord[] };
          error?: { message?: string };
        };
        if (!response.ok) {
          throw new Error(body.error?.message || "Couldn't load platform staff.");
        }
        return body.data?.staff ?? [];
      })
      .then((rows) => {
        if (alive) setStaff(rows);
      })
      .catch((fetchError: Error) => {
        if (alive) setError(fetchError.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const sortedStaff = useMemo(
    () =>
      [...staff].sort((left, right) => {
        const activeDelta = Number(right.active) - Number(left.active);
        if (activeDelta !== 0) return activeDelta;
        return left.name.localeCompare(right.name);
      }),
    [staff],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setTempPassword(null);
    startTransition(async () => {
      const response = await fetch("/api/bff/admin/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { user?: PlatformStaffRecord; tempPassword?: string | null };
        error?: { message?: string };
      };
      if (!response.ok || !body.data?.user) {
        setError(body.error?.message || "Couldn't create the staff account.");
        return;
      }
      setStaff((current) => [body.data!.user!, ...current]);
      setSuccess(`Created ${body.data.user.name} (${body.data.user.role}).`);
      setTempPassword(body.data.tempPassword ?? null);
      setEmail("");
      setName("");
      setRole("SUPPORT");
    });
  }

  return (
    <div className="space-y-6">
      {canProvision ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-aivo-accent" />
            <h2 className="text-base font-semibold text-aivo-ink">Create platform staff</h2>
          </div>
          <p className="text-sm text-aivo-ink-soft">
            Provision least-privilege internal accounts without leaving the unified admin shell.
          </p>
          <form className="grid gap-3 lg:grid-cols-[1fr_1fr_220px_auto]" onSubmit={handleSubmit}>
            <Input
              type="email"
              placeholder="teammate@aivo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={pending}
            />
            <Input
              placeholder="Jordan Rivera"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={pending}
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as (typeof ROLE_OPTIONS)[number]["value"])}
              className="h-10 rounded-iw-control border border-aivo-border bg-white px-3 text-sm outline-none focus:border-aivo-primary"
              disabled={pending}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating
                </span>
              ) : (
                "Create"
              )}
            </Button>
          </form>
          {error ? (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3" role="alert">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              <p className="text-sm text-aivo-ink">{error}</p>
            </div>
          ) : null}
          {success ? (
            <div className="space-y-2 rounded-lg bg-emerald-50 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <p className="text-sm text-aivo-ink">{success}</p>
              </div>
              {tempPassword ? (
                <code className="block rounded bg-white px-3 py-2 font-mono text-sm">
                  {tempPassword}
                </code>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3">
          <p className="text-sm font-medium">
            {loading ? "Loading staff..." : `${sortedStaff.length} staff account${sortedStaff.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-aivo-ink-soft">Loading platform staff...</div>
        ) : sortedStaff.length === 0 ? (
          <div className="p-4 text-sm text-aivo-ink-soft">No platform staff accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {sortedStaff.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3 font-medium">{member.name}</td>
                    <td className="px-4 py-3 text-aivo-ink-soft">{member.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone="warning">{member.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={member.active ? "success" : "neutral"}>
                        {member.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {member.lastLoginAt
                        ? new Date(member.lastLoginAt).toLocaleString()
                        : "No sign-in yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
