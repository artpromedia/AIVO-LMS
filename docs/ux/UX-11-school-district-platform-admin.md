# UX-11 — School, District & Platform Admin

> **Last refreshed**: 2026-05-17 — verified current with 17 admin routes added since the last refresh. **District admin**: `staff`, `iep`, `settings/{admins,branding,sso}`. **Platform admin**: `tenants/[id]`, `users/[id]`, `learners` (cross-tenant index), `jobs` (background-job inspector), `billing/{coupons,daily-batch,invoices,revenue}`, `settings/{api-keys,emails,webhooks}`, `ai/{moderation,playground}`. All folded into UX-01 §1; the §1 "three admin roles, three jobs" framing is unchanged.
>
> **Source of truth.** Grounded in `apps/web-v2/app/admin/{school,district,platform}/**` and shared admin BFFs under `app/api/bff/admin/**`. **Most admin overview pages are still placeholders rendering hardcoded demo numbers.** Several deep pages (audit logs, review queue, billing, AI costs) are real and shippable.
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

## 2026-06-06 Standalone Admin Update

The current admin source of truth for newly relocated surfaces is `apps/web-admin`, not the deleted
`apps/web-v2/app/admin/**` routes described by the older audit below.

- `/platform` now renders real platform health counts.
- `/platform/districts/new` securely creates a district and emails its first admin a token invite.
- `/platform/districts` lists cross-tenant invites and provides audited resend/revoke actions.
- `/district` renders real school/staff/learner counts and a persisted first-run setup checklist.
- No onboarding surface creates or displays a plaintext temporary password.

## 1. Three admin roles, three jobs

| Role             | Scope                       | Primary job                                                  |
| ---------------- | --------------------------- | ------------------------------------------------------------ |
| `school_admin`   | one school (tenant)         | manage staff, classes, school‑level compliance reports       |
| `district_admin` | many schools (tenant‑group) | cross‑school oversight, rostering, district reporting        |
| `platform_admin` | every tenant                | system health, safety review, billing, AI costs, audit trail |

They share an `AppShell` chrome but **the navigation is role‑specific** (separate `SCHOOL_NAV`, `DISTRICT_NAV`, `PLATFORM_NAV` arrays in `components/layout/role-shells.tsx` and the local files at `app/admin/{school,district,platform}/page.tsx`).

## 2. Principles

1. **No write actions on the overview.** Overview pages are _signal only_. Every state‑changing action lives on a dedicated detail page with its own server action + audit entry.
2. **Tenant scoping is the law.** Even platform admins act through `scopeTenantsForSession(role, tenantId)` (`audit-logs/page.tsx:15`) — never a raw cross‑tenant query.
3. **Audit everything.** Every admin BFF that writes data calls `audit(session, action, …)`. The action vocabulary is the contract the audit log page renders.
4. **Honesty over polish.** Where data is placeholder, the card carries a _Demo data_ badge (see `admin/school/page.tsx:39`). Do not paint over placeholders with chartjunk.

## 3. Sitemap (shipped today)

```
School admin (SCHOOL_NAV in components/layout/role-shells.tsx)
/admin/school                              🟡 hardcoded stats — Staff/Classes/Active learners (demo data)
/admin/school/staff                        🟡
/admin/school/learners                     ✅ real repo-backed list
/admin/school/classes                      ✅ real repo-backed list
/admin/school/rostering                    🟡 import scaffolding (Google Classroom / Clever / ClassLink / Canvas)
/admin/school/reports                      ✅ real computeSystemHealth stats
/admin/school/billing                      ✅ BillingAccount-backed
/admin/school/compliance                   🟡 single static card
/admin/school/users                        🟡
/admin/school/settings                     🟡 shared settings shell

District admin (DISTRICT_NAV)
/admin/district                            🟡 hardcoded stats — Schools/Staff/Learners/IEPs (demo data)
/admin/district/schools                    🟡 placeholder list
/admin/district/reports                    ✅ real computeSystemHealth + tenant counts
/admin/district/billing                    ✅ BillingAccount-backed
/admin/district/compliance                 🟡
/admin/district/settings                   🟡

Platform admin (PLATFORM_NAV)
/admin/platform                            🟡 hardcoded stats — Tenants/Learners/Active sessions (demo data)
/admin/platform/tenants                    🟡 list of real tenants
/admin/platform/users                      🟡
/admin/platform/data                       🟡
/admin/platform/migration                  🟡
/admin/platform/system-health              🟡
/admin/platform/security                   🟡
/admin/platform/settings                   🟡
/admin/platform/support                    🟡
/admin/platform/audit-logs                 ✅ real audit log table, tenant-scoped, 200-row cap
/admin/platform/safety/review-queue        ✅ real moderation review queue with allow/block actions
/admin/platform/safety/*                   🟡 additional safety surfaces
/admin/platform/security/state-privacy     🟡 static page
/admin/platform/compliance/dsar            🟡 list view only — no per-request detail route
/admin/platform/compliance/*               🟡 additional compliance surfaces
/admin/platform/ai-costs                   ✅ per-tenant LLM/TTS budgets, MTD spend, hard caps, recent events
/admin/platform/ai-generation              🟡 generation job inspector
/admin/platform/audio                      🟡 audio asset / TTS inspector
/admin/platform/billing                    🟡 BillingAccount table reads real data
/admin/platform/curriculum/*               🟡 admin authoring scaffolding
```

### Honest summary

The admin **section breadth is large** — well over twenty routes. The depth ranges from _real and shippable_ (audit logs, review queue, AI costs, school/district reports, school/district billing) to _signal‑only placeholders_ (school/district/platform overview pages). Every overview page is the same anti‑pattern: hardcoded demo KPIs instead of a one‑line call to `computeSystemHealth` or a `listX().length`. Fixing the three overviews is the single highest‑ROI sprint in the admin app.

## 4. School Admin

### `/admin/school` (🟡)

Source: `admin/school/page.tsx` (49 lines). Renders:

- Page header: _Westbrook Elementary_ + _"Staff, classes, and school-level reporting."_ — **the school name is hardcoded.** First sprint task is to call `getTenantById(session.tenantId).name`.
- Three KPI cards: Staff 42, Classes 18, Active learners 411 — all literals with _Demo data_ badges.
- Compliance section: _"All systems nominal. Detailed reports arrive in Sprint 23."_ (Sprint 23 has shipped — strip the reference.)

### What `/admin/school` should be (⬜ → 🟡)

The school admin's actual day‑1 workflows:

1. **Manage staff** — invite a teacher, promote a teacher to grade‑lead, remove access. Backed by existing user/role repos; UI to build.
2. **Oversee classes** — list of classrooms with teacher + roster size + last‑activity date. `listClassrooms(tenantId)` exists.
3. **School compliance** — count of learners with current `child_data_collection` consent, count of IEPs uploaded, link to the school's DSAR queue.
4. **School reports** — % of learners with a completed baseline, average lessons/week, top skill gaps. Computable from `listLearners(tenantId)` + `getMasteryMap` per learner.

Each maps cleanly to existing repo helpers. The work is UI, not data.

### Nav (✅)

`SCHOOL_NAV` (in `components/layout/role-shells.tsx`) — Overview, Staff, Learners, Classes, Rostering, Reports, Billing, Compliance, Settings. The school overview page (`admin/school/page.tsx:8-14`) redeclares its own local nav array with only five items (Overview, Staff, Reports, Compliance, Settings) — replace with the shared import so the overview matches every other school page.

## 5. District Admin

### `/admin/district` (🟡)

Source: `admin/district/page.tsx` (46 lines). Identical pattern to school: hardcoded _"Maple Hill USD"_ + four demo KPI cards (Schools 12, Staff 584, Learners 5 206, IEPs on file 612).

### What it should be (⬜ → 🟡)

District admins coordinate **across** schools. Their pages need:

1. **Schools list** — each row links to the school admin view for that tenant (district admins legitimately need cross‑tenant access _within their district_).
2. **Rostering pane** — Google Classroom / Clever / ClassLink / Canvas LMS hooks. Today these are placeholder cards on the teacher home; the district admin is the right surface for them.
3. **Cross‑school reports** — funnel from invitation → first lesson, IEPs‑per‑school, mastery growth by school.
4. **Bulk procurement** — district‑level seat counts, billing pointer (read‑only — billing actions are platform‑admin only).

### Cross‑tenant scoping

A district admin's `session.tenantId` is the district tenant, but `scopeTenantsForSession("district_admin", tenantId)` should return the district + every school tenant inside it. **Verify this returns the right set** before exposing school‑level data on the district view. If it doesn't, ship a `getTenantChildrenForDistrict(districtTenantId)` helper.

## 6. Platform Admin

### `/admin/platform` (🟡)

Source: `admin/platform/page.tsx` (45 lines). Three hardcoded KPI cards (Tenants 37, Learners 82 114, Active sessions 1 202), all green _Healthy_ badges.

### What it should be (⬜ → 🟡)

The platform admin overview is the **incident‑response dashboard**:

1. **System health** — real counts (`listTenants().length`, `listLearners().length` capped by sample) + a 7‑day error rate from `AuditLog` filtered to action prefix `*.error`.
2. **Safety pulse** — open review cases count (`listHumanReviewCases({ status: "open" }).length`), with deep link to `/admin/platform/safety/review-queue`.
3. **AI cost pulse** — last 24 h spend from `AiGenerationJob`, link into `/admin/platform/ai-costs`.
4. **Compliance pulse** — open DSARs, IEP backlog, link into `/admin/platform/compliance/dsar`.

### `/admin/platform/audit-logs` (✅)

Source: `admin/platform/audit-logs/page.tsx` (70 lines). **This is the model for a platform admin page.** Real data, server‑rendered table, tenant‑scoped via `scopeTenantsForSession`, 200‑row cap with newest first. Five columns: When · Action · Actor · Tenant · Request ID. The tenant column resolves IDs to names via `getTenantById`.

Nothing to change here for this sprint. Use it as the template for the others.

### `/admin/platform/safety/review-queue` (✅)

Source: `admin/platform/safety/review-queue/page.tsx` (86 lines). Real moderation review pipeline:

- Lists `HumanReviewCase` rows (open + in‑review + escalated + resolved).
- Each case shows `ModerationEvent` excerpt + classification categories + severity.
- Open + in‑review cases render the `<ReviewActions>` client component (allow / block / escalate).
- Tones: `open → warning`, `in_review → primary`, `escalated → danger`, resolved → `success`.

This page demonstrates the **right contract**: data + minimal chrome + server‑authoritative actions + audit. Replicate this shape for DSAR review.

### `/admin/platform/ai-costs` (✅)

Source: `admin/platform/ai-costs/page.tsx`. Real per-tenant LLM/TTS spend with hard caps:

- Per-tenant rows: `getAIBudget(tenantId)` (monthly cap in cents, currently null = uncapped allowed), `monthToDateSpendCents(tenantId)`, `checkAIBudget(tenantId)` (returns `{ allow, warning }`).
- Aggregate header tiles: total MTD spend, count of over-budget tenants, count of warning-state tenants.
- Recent cost events: `listAICostEvents({ limit: 50 })` joined to tenant name via `tenantsById`.
- `<BudgetEditor>` client component for editing per-tenant caps (server-authoritative; audited).

Remaining gaps (🟡): 7-day trend chart; Slack threshold pings via the `comms-svc` hook referenced in `replit.md`.

### `/admin/platform/security/state-privacy` (🟡)

Static page describing AIVO's data residency posture. No interactive controls today. Acceptable as a placeholder; the real work is policy, not UX.

### `/admin/platform/compliance/dsar` (🟡)

Data Subject Access Request queue. **List view only — there is no `[requestId]` per-request detail route today.** The fulfillment actions (export learner data, delete learner data) are not surfaced in the UI; whether they exist as BFFs at all needs verification. Decision needed: does fulfillment happen in‑app or by ticket to a human operator? **Block any "marketing-ready" claim until this is resolved end‑to‑end** — at minimum, add a `[requestId]/page.tsx` with the request payload + a _Mark fulfilled / Export / Delete_ action set scoped to platform admins.

## 7. Cross‑role chrome — AppShell

All admin pages render through `AppShell` (`components/layout/app-shell.tsx`) with role‑specific nav arrays. The shell auto‑renders the _role label_ in the corner (e.g. _Platform admin_), which is the only persistent reminder of which scope the user is operating in. That reminder matters — confusing your district admin role with your platform admin role is one Postmortem away.

### Proposed reminder microcopy (⬜)

For platform admins specifically, add a small persistent _"Acting as: Platform admin · {tenantCount} tenants"_ line in the header. Prevents the "I thought I was scoped to one school" class of incident.

## 8. Microcopy bank

| Surface                | String                                                         | Notes                     |
| ---------------------- | -------------------------------------------------------------- | ------------------------- |
| Admin role label       | _"School admin"_ / _"District admin"_ / _"Platform"_           | Set on the AppShell       |
| Audit empty            | _"No audit events yet"_                                        | EmptyState                |
| Review queue empty     | _"No review cases yet."_                                       | inline card               |
| KPI placeholder badge  | _"Demo data"_                                                  | drop once wired           |
| Compliance placeholder | _"All systems nominal. Detailed reports arrive in Sprint 23."_ | strip — Sprint 23 shipped |

## 9. State matrix

| Page                        | State                               | UX                                                                                                            |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Any overview                | No data yet                         | Real `0` with a non‑demo badge — never _"Demo data"_ once we've moved off placeholders                        |
| Audit logs                  | 0 events                            | `EmptyState` _"No audit events yet"_                                                                          |
| Review queue                | 0 cases                             | Inline card _"No review cases yet."_                                                                          |
| Review queue                | Open case                           | Status badge + `<ReviewActions>` row                                                                          |
| Review queue                | Resolved case                       | Status badge + _"Resolution: {text}"_ footer                                                                  |
| DSAR detail                 | Awaiting export                     | (🟡) Currently shows status only — needs an explicit _"Export in progress"_ visual once the pipeline is wired |
| AI costs                    | Threshold exceeded                  | Banner with link to the offending tenant                                                                      |
| Cross‑tenant access attempt | platform admin clicks into a tenant | `audit(session, "platform.tenant.view", { tenantId })`                                                        |

## 10. Engineering handoff

| Concern               | Where                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Role nav arrays       | `components/layout/role-shells.tsx` + per‑page local arrays in `app/admin/{school,district,platform}/page.tsx`                              |
| Tenant scoping helper | `scopeTenantsForSession(role, tenantId)` in `lib/db/repos.ts`                                                                               |
| Audit                 | `lib/bff/audit.ts` — action vocabulary listed under `/admin/platform/audit-logs`                                                            |
| Moderation pipeline   | `lib/db/repos.ts` (`listHumanReviewCases`, `getModerationEvent`, `resolveReviewCase`) + `app/admin/platform/safety/review-queue/actions.ts` |
| AI cost data          | `AiGenerationJob` in `lib/db/types.ts:765-774`                                                                                              |
| DSAR pipeline         | `app/admin/platform/compliance/dsar/**` — verify fulfillment end‑to‑end before claiming ready                                               |

## 11. Acceptance criteria — honest

- ✅ Every admin page enforces `requirePageRole([…])` against the matching role(s).
- ✅ Audit log table reads real data, scoped, capped, newest first.
- ✅ Review queue allow/block actions are server‑authoritative and produce audit entries.
- 🟡 School + District + Platform overview pages render hardcoded demo KPIs. Wire them to `computeSystemHealth` + tenant counts as `school/reports` and `district/reports` already do.
- 🟡 District admin scoping (`scopeTenantsForSession("district_admin", …)`) needs verification that it returns child‑school tenants.
- ✅ AI costs page is real with per-tenant budgets, MTD spend, hard caps, and a recent-events log. Trend chart + Slack pings are 🟡.
- 🟡 DSAR has only a list view; per-request detail and fulfillment actions are missing.
- ⬜ No platform‑admin incident banner ("active incident, drop everything") today.
- 🟡 School-side rostering UI exists at `/admin/school/rostering` (Google Classroom / Clever / ClassLink / Canvas scaffolding); district-level rostering is not yet a dedicated route.

## 12. Open questions

1. Where does **billing for districts** sit? Today `BillingAccount` is a flat table; district plans need parent/child accounts so a district can pay on behalf of all its schools.
2. **Multi‑role users** (a principal who's also a teacher) — today a user has one role. Confirm whether the admin app should support a role switcher, or whether we treat dual‑role humans as two separate user records.
3. **Exporting raw learner data** for FERPA — is this a one‑click admin operation, or always a human‑mediated DSAR? §6 DSAR section flags this.
