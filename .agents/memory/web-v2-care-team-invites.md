---
name: web-v2 care-team invites architecture
description: Where the web-v2 team-invite flow actually lives, and how to mirror it for a new role
---

## web-v2 care-team invites use LOCAL persistence, not family-svc

The web-v2 (port 5000) care-team invite flow persists via `@/lib/db/team-invites`
(`createInvite` / `getCareTeam` / `revokeInvite`) — these are role-agnostic and
enforce seat limits + dup + email validation. **family-svc `collaboration.ts` is a
SEPARATE backend for mobile/other clients and is NOT called by web-v2.**
`@/lib/collaboration/contribution-status.ts` deliberately re-derives the SAME
shape as family-svc's contributions endpoint from the local web stores.

**Why:** web-v2 is its own self-contained system of record; treating its local
persistence as a "mock" and routing to family-svc would split the source of truth
the user actually previews.

**How to apply (adding invites for a new role, e.g. teacher):**
- Per-role server actions under `app/<role>/learners/[learnerId]/team/actions.ts`:
  `requirePageRole([role])` + the role's access check (`teacherCanAccessLearner` /
  `parentCanAccessLearner`), then reuse `createInvite`/`revokeInvite`. RBAC lives
  in the action, not the shared lib.
- Restrict invitable roles per inviter (a teacher invites caregiver|therapist
  only — the single teacher seat is parent-owned).
- Revoke must check BOTH authorship (`invitedBy === session.userId`) AND lifecycle
  (`status === "PENDING"`) server-side — `revokeInvite` itself revokes any found
  record regardless of status, so the guard belongs in the action.
- **Do NOT reuse the parent `TeamHub` component for another role.** Its embedded
  Remind/Remove buttons import parent server actions (`requirePageRole(["parent"])`)
  and will 403 for other roles. Render a read-only status list instead.

## i18n audit gate
`pnpm i18n:audit` HARD-FAILS on missing/orphan keys (exit 1), only WARNS on
untranslated copy. New namespaces must be added to ALL 10 web-v2 locale files
(`apps/web-v2/lib/i18n/messages/*.json`); English placeholder values are fine.
