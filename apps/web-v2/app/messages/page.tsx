/**
 * Top-level Messages surface — ADR 0020 Phase 2, slice 2.
 *
 * Per `CROSS_CUTTING_REGISTRY.messages` (`@aivo/nav`), the canonical
 * destination for the messages surface is `/messages` on web and
 * mobile, anchored on the `messages` NavArea — the same NavArea
 * `/notifications` is anchored on. Both surfaces therefore share the
 * `canAccessArea(session, "messages", "web")` decision, so the four
 * outcomes — `allow` / `switch-role` / `locked` / `forbidden` — match
 * what every other shell consumer of `canAccessArea` produces. No
 * parallel RBAC table.
 *
 * Implementation note: no per-role `/.../messages` web pages existed
 * on disk prior to this slice (the `legacyRoutes` entries in
 * `CROSS_CUTTING_REGISTRY.messages` were aspirational placeholders).
 * This slice therefore lands the canonical route shell with a
 * role-aware empty-state body; the unified inbox (threads, compose,
 * attachments, BFF) lands in a follow-up. The migration's job here
 * is to anchor the canonical route + RBAC, not to ship the full
 * messaging product.
 */
import { ReassuranceCard } from "@aivo/ui";
import { requirePageRole } from "@/lib/auth/server";
import { MessagesInbox } from "./messages-inbox";
import { buildRoleSession } from "@/lib/auth/role-session";
import { ROLE_LABEL, type Role } from "@/lib/auth/types";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RoleGate } from "@/components/auth/role-gate";
import {
  LEARNER_NAV,
  PARENT_NAV,
  TEACHER_NAV,
} from "@/components/layout/role-shells";

const ALL_ROLES: Role[] = [
  "parent",
  "learner",
  "teacher",
  "caregiver",
  "therapist",
  "school_admin",
  "district_admin",
  "platform_admin",
];

const ROLE_NAV = {
  parent: PARENT_NAV,
  learner: LEARNER_NAV,
  teacher: TEACHER_NAV,
} as const;

const PATHNAME = "/messages";

export default async function Page() {
  // Authenticated, but role-agnostic — `/messages` is the same entry
  // point for every role. `requirePageRole` is reused so the
  // `scripts/route-audit.mjs` auth-helper scan still recognises the
  // page as making an explicit auth choice.
  const session = await requirePageRole(ALL_ROLES);
  const roleSession = buildRoleSession(session);

  const navItems = ROLE_NAV[session.role as keyof typeof ROLE_NAV] ?? [];
  const roleLabel = ROLE_LABEL[session.role];

  return (
    <AppShell
      role={session.role}
      roleLabel={roleLabel}
      navItems={navItems}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <RoleGate session={roleSession} area="messages" pathname={PATHNAME}>
        <PageHeader
          eyebrow={roleLabel}
          title="Messages"
          description="Conversations with your AIVO team — teachers, caregivers, and support."
        />
        <MessagesInbox />
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReassuranceCard
            tone="privacy"
            title="Private to your account"
            body="Only people you've added to your AIVO team can message you here."
          />
          <ReassuranceCard
            tone="safety"
            title="Safety stays on"
            body="Safety filtering applies to every message, including those from staff."
          />
        </section>
      </RoleGate>
    </AppShell>
  );
}
