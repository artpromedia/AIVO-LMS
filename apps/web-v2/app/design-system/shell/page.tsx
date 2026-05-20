"use client";

/**
 * Live demo of the calm @aivo/ui/shell wrapping a mock dashboard.
 *
 * Lets reviewers flip between roles and see the sidebar, locked rows,
 * command bar, role switcher, breadcrumbs, and page container without
 * touching the existing role dashboards.
 */
import * as React from "react";
import Link from "next/link";
import {
  AppShell,
  Breadcrumbs,
  PageContainer,
  GlassCard,
  MetricCard,
  HeroPanel,
  InsightChip,
  AivoIcon,
  LockedScreen,
  type Role,
} from "@aivo/ui";
import { ROLES, ROLE_META } from "@aivo/nav";
import { activeAreaFromPath } from "../../../lib/shell/active-area";

const ACCOUNT = {
  name: "Ofem Akah",
  email: "ofem@example.com",
  initials: "OA",
};

const PREVIEW_PATHS: Record<Role, string> = {
  learner: "/learner/home",
  parent: "/parent/home",
  teacher: "/teacher/home",
  schoolAdmin: "/admin/school",
  districtAdmin: "/admin/district",
  internal: "/admin/platform",
};

export default function ShellShowcase() {
  const [role, setRole] = React.useState<Role>("parent");

  const previewPath = PREVIEW_PATHS[role];
  const activeArea = activeAreaFromPath(previewPath);

  const roleOptions = React.useMemo(
    () => ROLES.map((id) => ({ id, available: true })),
    [],
  );

  return (
    <AppShell
      sidebar={{
        role,
        activeArea,
        linkAs: Link,
        brand: (
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-iw-control bg-[var(--aivo-color-aivoPurple-100)]">
              <AivoIcon name="aiSparkle" tone="brand" className="h-4 w-4" />
            </span>
            <span className="font-semibold text-iw-text-strong">AIVO</span>
          </span>
        ),
      }}
      commandBar={{
        role,
        account: ACCOUNT,
        roleOptions,
        onRoleSelect: (next) => setRole(next),
        unreadCount: 3,
      }}
      showSidebarOnMobile={false}
    >
      <PageContainer
        breadcrumbs={
          <Breadcrumbs
            linkAs={Link}
            items={[
              { label: "AIVO", href: "/design-system" },
              { label: "Design system", href: "/design-system" },
              { label: "Shell" },
            ]}
          />
        }
        eyebrow={`${ROLE_META[role].label} view`}
        title="Shell — live preview"
        subtitle="Pick a role from the top bar to see how the sidebar, locked rows, and breadcrumbs change."
        actions={
          <InsightChip tone="info" size="md">
            Demo only · no data writes
          </InsightChip>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Active learners" value="2" />
          <MetricCard label="Pending approvals" value="1" delta={null} />
          <MetricCard label="This week" value="14" suffix="/ 20" delta={12} />
          <MetricCard label="Open messages" value="3" delta={-2} deltaTone="success" />
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <HeroPanel
              tone="primary"
              eyebrow={`Hi, ${ACCOUNT.name.split(" ")[0]}`}
              title="Today's next step"
              subtitle="Emma's reading baseline finishes in 12 minutes. We'll show her starting point as soon as it lands."
              primaryAction={
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-iw-chip bg-[var(--aivo-sensory-primary)] text-white text-sm font-semibold shadow-md">
                  See Emma's profile
                </span>
              }
              secondaryAction={
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-iw-chip border border-iw-border bg-white text-iw-text-strong text-sm font-semibold">
                  Set a goal
                </span>
              }
              chips={
                <>
                  <InsightChip tone="success">Baseline running</InsightChip>
                  <InsightChip tone="info">IEP synced</InsightChip>
                </>
              }
            />
          </div>
          <GlassCard
            density="base"
            radius="card-lg"
            title="Locked example"
            description={`What '${ROLE_META[role].label}' sees when reaching a restricted area`}
          >
            <div className="-m-6">
              <LockedScreen role={role} area="aiTutor" linkAs={Link} />
            </div>
          </GlassCard>
        </div>
      </PageContainer>
    </AppShell>
  );
}
