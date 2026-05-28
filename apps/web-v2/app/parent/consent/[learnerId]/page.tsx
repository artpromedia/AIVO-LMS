import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getAgeGateForLearner,
  getLearner,
  listConsentsForLearner,
  listConsentVersions,
  parentCanAccessLearner,
} from "@/lib/db/repos";
import type { ConsentType } from "@/lib/db/types";
import { ConsentToggle } from "../consent-toggle";

const PER_LEARNER_TYPES: ConsentType[] = [
  "child_data_collection",
  "iep_document_storage",
  "ai_personalization",
  "teacher_access",
];

export default async function Page({ params }: { params: Promise<{ learnerId: string }> }) {
  const { learnerId } = await params;
  const session = await requirePageRole(["parent"]);
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const versions = listConsentVersions();
  const records = await listConsentsForLearner(session.userId, learnerId, session.tenantId);
  const ageGate = await getAgeGateForLearner(learnerId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`Consent · ${learner.displayName}`}
        title="Per-learner consents"
        description="Per-learner consents apply only to this child."
      />
      {ageGate?.requiresParentConsent ? (
        <Card className="p-4 mb-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-900">
            This learner is under 13. Parent consent is required for data collection per COPPA.
          </p>
        </Card>
      ) : null}
      <Card className="p-0 divide-y">
        {PER_LEARNER_TYPES.map((type) => {
          const version = versions.find((v) => v.consentType === type);
          const active = records.find((r) => r.consentType === type && r.revokedAt === null);
          return (
            <div key={type} className="p-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-semibold">{humanize(type)}</h3>
                  {active ? (
                    <Badge tone="success">Accepted</Badge>
                  ) : (
                    <Badge tone="neutral">Not accepted</Badge>
                  )}
                </div>
                <p className="text-sm text-aivo-ink-soft mt-1">
                  {version?.summary ?? "No description available."}
                </p>
                <p className="text-xs text-aivo-ink-soft mt-1">Version {version?.version ?? "—"}</p>
              </div>
              <ConsentToggle consentType={type} accepted={Boolean(active)} learnerId={learnerId} />
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
