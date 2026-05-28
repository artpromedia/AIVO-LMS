import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listConsentVersions, listConsentsForUser } from "@/lib/db/repos";
import { CONSENT_TYPES } from "@/lib/db/types";
import { ConsentToggle } from "./consent-toggle";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const versions = listConsentVersions();
  const records = await listConsentsForUser(session.userId, session.tenantId);

  const accountTypes = CONSENT_TYPES.filter(
    (t) => !["child_data_collection", "iep_document_storage", "teacher_access"].includes(t),
  );

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Privacy"
        title="Consent center"
        description="Each consent is versioned. Revoking disables the related feature without deleting required audit history."
      />
      <Card className="divide-y divide-iw-border p-0">
        {accountTypes.map((type) => {
          const version = versions.find((v) => v.consentType === type);
          const active = records.find(
            (r) => r.consentType === type && r.learnerId === null && r.revokedAt === null,
          );
          return (
            <div key={type} className="flex items-start justify-between gap-4 bg-iw-card p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-iw-display text-base font-semibold text-iw-ink">{humanize(type)}</h3>
                  {active ? (
                    <Badge tone="success">Accepted</Badge>
                  ) : (
                    <Badge tone="warning">Not accepted</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-iw-ink-muted">
                  {version?.summary ?? "No description available."}
                </p>
                <p className="mt-1 text-xs text-iw-ink-muted">
                  Version {version?.version ?? "—"}
                  {active ? ` · accepted ${formatDate(active.acceptedAt)}` : ""}
                </p>
              </div>
              <ConsentToggle consentType={type} accepted={Boolean(active)} learnerId={null} />
            </div>
          );
        })}
      </Card>
    </AppShell>
  );
}

function humanize(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
