import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { listRosterImportJobs, listSISConnections, listSchools } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const schools = listSchools(session.role === "platform_admin" ? undefined : session.tenantId);
  const connections = listSISConnections(session.tenantId);
  const jobs = listRosterImportJobs(session.tenantId).slice(0, 25);

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title="Rostering"
        description="Connect your SIS or upload a CSV to import schools, classrooms, teachers, and learners."
        actions={
          schools.length > 0 ? (
            <Link href={`/admin/school/rostering/import?schoolId=${schools[0]!.id}`}>
              <Button>Start CSV import</Button>
            </Link>
          ) : null
        }
      />

      <SectionHeader title="Schools" description="Every school in your tenant." />
      {schools.length === 0 ? (
        <EmptyState
          title="No schools yet"
          description="A school is created automatically on first roster import."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schools.map((s) => (
            <Card key={s.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{s.name}</p>
                  <p className="text-xs text-aivo-muted">{s.gradeBands.join(", ")}</p>
                </div>
                <Badge tone="neutral">{s.id}</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/admin/school/classes?schoolId=${s.id}`}>
                  <Button variant="outline" size="sm">
                    Classes
                  </Button>
                </Link>
                <Link href={`/admin/school/rostering/import?schoolId=${s.id}`}>
                  <Button size="sm">Import CSV</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionHeader
        className="mt-10"
        title="SIS connections"
        description="Clever, ClassLink, OneRoster, or Google Classroom."
      />
      {connections.length === 0 ? (
        <EmptyState
          title="No SIS connection yet"
          description="OAuth setup for Clever and ClassLink lands in a follow-up sprint. CSV import is available now."
        />
      ) : (
        <div className="grid gap-3">
          {connections.map((c) => (
            <Card key={c.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-aivo-muted">
                  Provider: {c.provider} · last sync: {c.lastSyncedAt ?? "never"}
                </p>
              </div>
              <Badge
                tone={
                  c.status === "active" ? "success" : c.status === "paused" ? "warning" : "neutral"
                }
              >
                {c.status}
              </Badge>
            </Card>
          ))}
        </div>
      )}

      <SectionHeader
        className="mt-10"
        title="Recent import jobs"
        description="Audit trail of every roster sync."
      />
      {jobs.length === 0 ? (
        <EmptyState title="No imports yet" description="Run your first CSV import above." />
      ) : (
        <Card className="divide-y divide-aivo-border">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-aivo-muted">{j.id}</p>
                <p className="text-sm">
                  {j.source.toUpperCase()} → school {j.schoolId}
                  {j.dryRun ? " · dry run" : ""}
                </p>
                <p className="text-xs text-aivo-muted">
                  {new Date(j.createdAt).toLocaleString()} · {j.createdRows} created ·{" "}
                  {j.skippedRows} skipped · {j.errorRows} errors
                </p>
              </div>
              <Badge
                tone={
                  j.status === "completed"
                    ? "success"
                    : j.status === "failed"
                      ? "danger"
                      : j.status === "dry_run"
                        ? "primary"
                        : "warning"
                }
              >
                {j.status}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </AppShell>
  );
}
