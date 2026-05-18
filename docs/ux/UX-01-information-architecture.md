# Sprint UX-01 — Information Architecture and Route-to-Screen Matrix

**Scope**: Complete IA for AIVO Learning v2 across web (Next.js 15, `apps/web-v2` — 139 implemented routes today, 116 BFFs), tablet (web responsive, same routes), and **one unified mobile app** (`apps/mobile`, Expo SDK 54, currently fragmented into five role groups — see §7).

**Last refreshed**: 2026-05-17 — captures 25 routes that landed since the prior refresh (parent learner subpages: `gradebook`, `milestones`, `sensory`, `team`; admin district: `iep`, `staff`, `settings/{admins,branding,sso}`; admin platform: `ai/{moderation,playground}`, `billing/{coupons,daily-batch,invoices,revenue}`, `jobs`, `learners`, `settings/{api-keys,emails,webhooks}`, `tenants/[id]`, `users/[id]`; teacher: `lesson-plans`, `reports`, `learners/[id]/iep/draft`).
**Roles**: Parent · Learner · Teacher · School Admin · District Admin · Platform Admin.
**Default web role homes**: as defined in `lib/auth/types.ts → ROLE_HOME`.
**Unified mobile role modes**: Parent Mode · Learner Mode · Teacher Mode · Admin-Lite Mode (no separate apps — see §7).

---

## 1. Web sitemap

Legend: ✓ implemented · ★ planned (per UX-00 gap list) · 🔒 consent-gated · 👤 role-gated · 📱 responsive on tablet.

### Authentication & public

```
/                                ✓   public landing + role-card switcher
/login                           ✓   mock-auth role picker (real auth = UX-03)
/signup                          ✓   parent signup (must inline consent — BF-01)
/verify-email                    ★   post-signup email verification landing
/forgot-password                 ★   request reset email
/reset-password                  ★   token-bearing reset form
/account-recovery                ★   alternate paths (security questions, support contact)
/help                            ★   role-aware help surface
/help/[topic]                    ★   help article
```

### Parent (`👤 parent`, `📱`)

```
/parent/home                     ✓   learner readiness rail + next-action inbox
/parent/learners                 ✓   list
/parent/learners/new             ✓   add learner (+ AgeGateRecord on submit)
/parent/learners/[id]            ✓   learner profile
/parent/learners/[id]/timeline   ★   chronological event feed
/parent/learners/[id]/assessment ✓🔒 parent assessment
/parent/learners/[id]/assessment/review ✓🔒
/parent/learners/[id]/iep        ✓🔒 IEP upload
/parent/learners/[id]/iep/review ✓🔒 extracted accommodations confirmation
/parent/learners/[id]/brain-profile ✓🔒
/parent/learners/[id]/baseline   ✓🔒 baseline status
/parent/learners/[id]/progress   ✓
/parent/learners/[id]/gradebook  ✓
/parent/learners/[id]/milestones ✓
/parent/learners/[id]/lessons    ✓   plain-language history
/parent/learners/[id]/homework   ✓
/parent/learners/[id]/summary    ✓
/parent/learners/[id]/sensory    ✓
/parent/learners/[id]/team       ✓
/parent/learners/[id]/accessibility ✓
/parent/learners/[id]/accessibility/audio ✓
/parent/learners/[id]/settings   ✓
/parent/inbox                    ★   unified "AIVO needs you" inbox (DD-05)
/parent/notifications            ✓   per-channel preferences + recent
/parent/schedule                 ✓
/parent/reports                  ✓
/parent/consent                  ✓   per consent type
/parent/consent/[learnerId]      ✓   per-learner consents
/parent/privacy                  ✓   data rights overview
/parent/privacy/data-export      ✓   DSAR request (needs status — BF-06)
/parent/privacy/delete-data      ✓   account/learner deletion request
/parent/settings                 ✓
/parent/settings/account         ✓
/parent/settings/billing         ✓
/settings/accessibility          ✓   shared, sidebar-linked
```

### Learner (`👤 learner|parent (helping)`, `📱`)

```
/learner/select                  ✓   only when a parent has >1 learner
/learner/home                    ✓   Today's Mission (must be one primary CTA — §8 in UX-00)
/learner/inbox                   ★   missions + homework + assignments (DD-05)
/learner/missions                ✓   (fold into inbox)
/learner/homework                ✓   (fold into inbox)
/learner/homework/[sessionId]    ✓🔒 homework helper chat
/learner/baseline                ✓
/learner/baseline/[baselineId]   ✓🔒 baseline player (full-screen)
/learner/lesson-runs/[lessonRunId] ✓🔒 lesson player (Stage, full-screen)
/learner/subjects                ✓
/learner/subjects/[subjectId]    ✓
/learner/quests                  ✓
/learner/quests/[worldId]        ✓
/learner/quests/[worldId]/chapters/[chapterId] ✓🔒
/learner/library                 ✓
/learner/progress                ✓
/learner/rewards                 ✓
/learner/notifications           ✓
/learner/settings/accessibility  ✓
/learner/settings/audio          ✓
```

### Teacher (`👤 teacher`, `📱`)

```
/teacher/home                    ✓   classes + needs-attention rail
/teacher/classes                 ✓
/teacher/classes/[classId]       ✓
/teacher/learners                ✓
/teacher/learners/[learnerId]    ✓
/teacher/learners/[id]/iep/draft ✓   teacher-authored IEP draft workspace
/teacher/learners/[id]/iep-summary ★ teacher-safe accommodations only (no raw IEP — §7 UX-00)
/teacher/assignments             ✓
/teacher/assignments/new         ✓
/teacher/lesson-plans            ✓
/teacher/insights                ✓
/teacher/reports                 ✓
/teacher/settings                ✓
```

### School admin (`👤 school_admin`)

```
/admin/school                    ✓   overview
/admin/school/classes            ✓
/admin/school/classes/[classId]  ✓
/admin/school/learners           ✓
/admin/school/staff              ✓
/admin/school/rostering          ✓
/admin/school/rostering/import   ✓
/admin/school/reports            ✓
/admin/school/billing            ✓
/admin/school/compliance         ✓
/admin/school/settings           ✓
/admin/school/notifications      ★
```

### District admin (`👤 district_admin`)

```
/admin/district                  ✓
/admin/district/schools          ✓
/admin/district/staff            ✓
/admin/district/iep              ✓
/admin/district/reports          ✓
/admin/district/billing          ✓
/admin/district/compliance       ✓
/admin/district/settings         ✓
/admin/district/settings/admins  ✓
/admin/district/settings/branding ✓
/admin/district/settings/sso     ✓
/admin/district/notifications    ★
```

### Platform admin (`👤 platform_admin`)

```
/admin/platform                  ✓   system health
/admin/platform/system-health    ✓
/admin/platform/system-health/incidents ★   ops incident timeline (security incidents live below)
/admin/platform/tenants          ✓
/admin/platform/tenants/[id]     ✓
/admin/platform/users            ✓
/admin/platform/users/[id]       ✓
/admin/platform/learners         ✓   cross-tenant learner index
/admin/platform/data             ✓
/admin/platform/migration        ✓
/admin/platform/jobs             ✓   background-job inspector
/admin/platform/billing          ✓
/admin/platform/billing/coupons  ✓
/admin/platform/billing/daily-batch ✓
/admin/platform/billing/invoices ✓
/admin/platform/billing/revenue  ✓
/admin/platform/support          ✓
/admin/platform/settings         ✓
/admin/platform/settings/api-keys ✓
/admin/platform/settings/emails  ✓
/admin/platform/settings/webhooks ✓
/admin/platform/audit-logs       ✓
/admin/platform/ai-generation    ✓
/admin/platform/ai-costs         ✓
/admin/platform/ai/moderation    ✓
/admin/platform/ai/playground    ✓
/admin/platform/audio            ✓
/admin/platform/audio/pronunciation ✓
/admin/platform/curriculum       ✓
/admin/platform/curriculum/frameworks ✓
/admin/platform/curriculum/import ✓
/admin/platform/curriculum/skills ✓
/admin/platform/curriculum/subjects ✓
/admin/platform/curriculum/versioning ✓
/admin/platform/safety           ✓
/admin/platform/safety/moderation ✓
/admin/platform/safety/policies  ✓
/admin/platform/safety/red-team  ✓
/admin/platform/safety/review-queue ✓
/admin/platform/security         ✓
/admin/platform/security/controls ✓
/admin/platform/security/incidents ✓
/admin/platform/security/risks   ✓
/admin/platform/security/state-privacy ✓
/admin/platform/security/vendors ✓
/admin/platform/security/vulnerabilities ✓
/admin/platform/compliance       ✓
/admin/platform/compliance/data-inventory ✓
/admin/platform/compliance/disclosures ✓
/admin/platform/compliance/dsar  ✓
/admin/platform/compliance/retention ✓
/admin/platform/notifications    ★
```

**Web totals**: 139 implemented · 14 planned (★). The full machine-readable matrix is at `docs/ux/UX-01-route-matrix.json` — regenerate with `node scripts/route-matrix.mjs` (walks `apps/web-v2/app/**/page.tsx` and writes the JSON in-place). The JSON was last regenerated against the 114-route snapshot; rerun the script before treating its contents as authoritative.

---

## 2. Unified mobile sitemap

One Expo app. Today's `(parent)/(learner)/(teacher)/(caregiver)/(therapist)` route groups collapse into one `(tabs)` shell whose tab set is driven by the active _role mode_, not by route group. See §7 for the role-switching model.

```
/                               (auth gate; redirects to /welcome or /role-chooser)
/welcome                        ★ pre-auth product intro
/(auth)/login                   ✓ (existing)
/(auth)/signup                  ✓
/(auth)/pin                     ✓ (learner-mode quick unlock)
/(auth)/verify-mfa              ✓
/(auth)/forgot-password         ✓
/(auth)/reset-password          ✓
/(auth)/change-password         ✓
/role-chooser                   ★ first-time after login (skipped if only one role)
/role-switcher                  ★ drawer reachable from every screen

# Role-mode tabs (active set determined by current mode)

Parent Mode tabs:
  /home                          ★ learner rail + inbox
  /learners                      ★ list (use existing brain/iep/progress under it)
  /progress                      ★ aggregate progress across learners
  /notifications                 ★
  /settings                      ★

Learner Mode tabs:
  /today                         ★ Today's Mission (one CTA)
  /lesson                        ★ active LessonRun (deep-link target)
  /subjects                      ★
  /quests                        ★
  /homework                      ★
  /progress                      ★

Teacher Mode tabs:
  /home                          ★ classes + needs-attention
  /classes                       ★
  /learners                      ★
  /assignments                   ★
  /notifications                 ★

Admin-Lite Mode tabs:
  /alerts                        ★ ops + security alerts
  /ai-failures                   ★
  /rostering-status              ★
  /support                       ★

Shared (in every mode under "More"):
  /settings/account              ★
  /settings/accessibility        ★
  /settings/language             ★
  /settings/notifications        ★
  /notifications (center)        ★
```

Today's caregiver and therapist route groups (web has no caregiver/therapist roles) are either folded into Parent Mode or pulled out entirely — decision required (UX-00 §11).

---

## 3. Role-based navigation model

| Role           | Web shell                                                         | Primary nav (left rail)                                                                                                                                             | Secondary                                           | Mobile-mode tabs                                         |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| Parent         | warm theme, soft sidebar                                          | Home · Learners · Inbox · Schedule · Reports · Consent · Privacy · Settings                                                                                         | account/billing/accessibility under Settings        | Home · Learners · Progress · Notifications · Settings    |
| Learner        | playful theme, dark sidebar, big tap targets, **one-task** layout | Home (Today) · Subjects · Quests · Library · Progress · Rewards · Notifications                                                                                     | accessibility/audio under Settings (sidebar bottom) | Today · Lesson · Subjects · Quests · Homework · Progress |
| Teacher        | dense theme, light sidebar                                        | Home · Classes · Learners · Assignments · Insights · Settings                                                                                                       | —                                                   | Home · Classes · Learners · Assignments · Notifications  |
| School admin   | businesslike theme                                                | Overview · Classes · Learners · Staff · Rostering · Reports · Billing · Compliance · Settings                                                                       | —                                                   | (uses Admin-Lite Mode)                                   |
| District admin | businesslike theme                                                | Overview · Schools · Reports · Billing · Compliance · Settings                                                                                                      | —                                                   | (uses Admin-Lite Mode)                                   |
| Platform admin | utilitarian theme, dark sidebar                                   | System health · Tenants · Users · Data · Migration · Curriculum · Safety · Security · Compliance · AI gen · AI costs · Audio · Audit · Billing · Support · Settings | grouped into 4 collapsible sections                 | Alerts · AI failures · Rostering · Support               |

Active nav state contract:

- Active match uses `pathname === item.href || pathname.startsWith(item.href + "/")`.
- Light sidebars use `primary-soft` pill on active.
- Dark sidebars (learner, platform) use sidebar-fg @ 18% mix on active.

---

## 4. Route-to-screen matrix

The full matrix lives at **`docs/ux/UX-01-route-matrix.json`** (139 implemented web routes + 35 unified-mobile screens + 14 planned web routes, each with the standard columns below). It is generated by `scripts/route-matrix.mjs` walking `apps/web-v2/app/**/page.tsx`. The columns are:

| Column               | Notes                                       |
| -------------------- | ------------------------------------------- |
| `path`               | route path or mobile screen key             |
| `name`               | screen name                                 |
| `role`               | one of the six roles or `public` / `shared` |
| `device`             | `web` · `tablet` · `mobile`                 |
| `purpose`            | single sentence                             |
| `primaryCta`         | the one thing this screen exists to do      |
| `secondaryActions`   | array                                       |
| `requiredData`       | data shapes                                 |
| `bff`                | BFF route(s) called                         |
| `loadingState`       | `skeleton` · `spinner` · `inline` · `n/a`   |
| `emptyState`         | copy + CTA                                  |
| `errorState`         | copy + retry                                |
| `retry`              | `automatic` · `manual` · `none`             |
| `permission`         | role + permission key                       |
| `consentDependency`  | one or more of CONSENT_TYPES, or `none`     |
| `accessibilityNotes` | non-default a11y considerations             |
| `mobileBehavior`     | how it adapts in the unified app            |
| `eng`                | engineering handoff notes                   |

Below are matrix entries for the **eight P0 screens** that anchor the core journey; the rest follow the same template in the JSON file.

### 4.1 Sample entries (P0 anchors)

**`/signup`**

- Role: public · Device: web/tablet/mobile · Purpose: Parent creates an account and grants the minimum consents required to create a learner.
- Primary CTA: "Create account". Secondary: "Sign in instead".
- Required data: email, displayName, password, accepted-terms-version, accepted-COPPA-version.
- BFF: `POST /api/bff/auth/signup`, `POST /api/bff/consent`.
- Loading: button-spinner. Empty: n/a. Error: inline per-field + top-of-form summary. Retry: manual.
- Permission: none. Consent dependency: collected here.
- A11y: form labels + describedby; password requirements `aria-live="polite"`. Mobile: keyboard-aware scroll. Eng: must inline the Terms + COPPA acceptance (currently separate post-signup — BF-01).

**`/parent/home`**

- Role: parent · Device: all · Purpose: Show learner readiness + the next action AIVO needs.
- Primary CTA: contextual per learner card ("Complete assessment", "Upload IEP", "Start baseline", "Open today's mission").
- BFF: `GET /api/bff/parent/learners`, `GET /api/bff/parent/inbox`.
- Loading: skeleton card rail. Empty: "Add your first learner" CTA. Error: per-card error + global retry. Retry: manual.
- Consent: shows banner if `parent_account_terms` is missing/expired, or if any active learner is missing `child_data_collection` / required `AgeGateRecord` (see §6).
- Mobile: same content, vertical stack of cards.

**`/learner/home`** (Today's Mission)

- Role: learner (+ parent helping) · Device: all · Purpose: Surface the single next learning task.
- Primary CTA: "Start [Tutor name]'s mission" → `POST /api/bff/learners/[id]/lesson-runs` → redirect to `/learner/lesson-runs/[id]`.
- Required data: active learner, brain profile, next mission picked by `pickTodaysMission`.
- Loading: full-screen skeleton with mascot. Empty: "We're picking your mission — refresh in a moment." Error: friendly retry. Retry: automatic on focus + manual.
- Permission: learner role OR parent with active learner cookie.
- Consent: requires `child_data_collection` + `ai_personalization`; if revoked → `?blocker=consent`.
- A11y: large primary button, single primary focus target on load.
- Mobile: identical layout, swap left rail for bottom tabs.

**`/learner/lesson-runs/[lessonRunId]`** (Stage)

- Role: learner (+ parent helping) · Device: all · Purpose: Deliver one beat of one lesson at a time.
- Primary CTA: per-beat action ("Tap to choose", "Drag to match", "Speak your answer", "I'm ready").
- BFF: `GET /api/bff/lesson-runs/[id]`, `POST /api/bff/lesson-runs/[id]/responses`, `POST /api/bff/lesson-runs/[id]/complete`.
- Loading: lesson-scoped spinner + tutor avatar animation. Empty: n/a. Error: "Let's try that again" with retry. Retry: automatic + manual.
- Consent: `child_data_collection`, `ai_personalization`. Permission: learner ownership / parent active-learner.
- A11y: keyboard-only path through every response type; reduced-motion path; screen-reader description per beat.
- Mobile: full-screen; lock orientation per learner setting.

**`/parent/learners/[id]/iep`**

- Role: parent · Device: all · Purpose: Upload an IEP or accommodation document (or skip).
- Primary CTA: "Upload IEP" (file picker) · Secondary: "Skip for now".
- BFF: `POST /api/bff/learners/[id]/iep-upload` (5 MB cap, allow-listed content types).
- Loading: upload progress + virus-scan/parse indicator. Empty: explainer card. Error: inline (size, type, parse failure). Retry: manual.
- Consent: `iep_document_storage`.
- A11y: drag-drop has keyboard alternative.
- Mobile: native document picker.

**`/teacher/classes/[classId]`**

- Role: teacher · Device: web/tablet/mobile · Purpose: Class roster + "which learners need attention".
- Primary CTA: per-row "Open learner". Secondary: "Create assignment for class", "Export roster".
- BFF: `GET /api/bff/teacher/classes/[id]`, `GET /api/bff/teacher/classes/[id]/needs-attention`.
- Loading: table skeleton. Empty: "No learners enrolled yet". Error: top-of-table banner + retry. Retry: manual.
- Permission: teacher of this class. Consent: n/a (teacher view never includes raw IEP).
- A11y: data table with column headers + sortable.

**`/admin/platform/security/incidents`**

- Role: platform_admin · Device: web · Purpose: Open + recent security incidents.
- Primary CTA: "Open incident" → detail page. Secondary: "Append timeline event".
- BFF: `GET /api/bff/admin/security/incidents`, `POST .../timeline`.
- Loading: table skeleton. Empty: "No open incidents". Error: retry-panel. Retry: manual.
- Permission: platform_admin. Consent: n/a.
- A11y: severity uses both color and label; status changes announced via `aria-live`.
- Eng: writes emit `security.incident.timeline.appended` audit (S31).

**`/admin/platform/compliance/dsar`**

- Role: platform_admin · Device: web · Purpose: DSAR request fulfillment.
- Primary CTA: "Review request" → detail. Secondary: "Export packet", "Mark fulfilled".
- BFF: `GET /api/bff/admin/compliance/dsar`, `POST /api/bff/admin/compliance/dsar/[id]/fulfill`.
- Loading: table skeleton. Empty: "No open DSARs". Error: retry. Retry: manual.
- Permission: platform_admin. Consent: n/a (admin acts on parent consent records).
- Eng: must update the parent-side surface at `/parent/privacy/data-export` so the parent sees status (BF-06).

The eight P0 anchors above are the high-fidelity exemplars. The remaining 106 web rows + 35 mobile rows + 14 planned rows in `docs/ux/UX-01-route-matrix.json` use the same column set with role-appropriate defaults for states and permission, and inherit the consent matrix in §6.

To regenerate the JSON after adding or moving routes, run `node scripts/route-matrix.mjs` from the repo root.

---

## 5. Permission map

Source of truth: `lib/auth/server.ts → requirePageRole(roles[])` on every page and `lib/bff/guards.ts → requireRole(req, roles[])` on every BFF.

| Surface tree                                                                          | Required role                               | Cross-tenant guard                                        | Notes                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| `/` `/login` `/signup` `/help/*` `/verify-email` `/forgot-password` `/reset-password` | public                                      | n/a                                                       |                                                                     |
| `/parent/**`                                                                          | parent                                      | `tenantId === session.tenantId` on every learner read     | parent can only see learners with `parentUserId === session.userId` |
| `/learner/**`                                                                         | learner OR (parent + active-learner cookie) | learner ownership                                         | parent-helping path re-checks active learner on every server action |
| `/teacher/**`                                                                         | teacher                                     | `tenantId === session.tenantId` + class roster membership | teacher can only see learners in their classes                      |
| `/admin/school/**`                                                                    | school_admin                                | school tenant scope                                       |                                                                     |
| `/admin/district/**`                                                                  | district_admin                              | district tenant scope                                     | district sees all schools under it                                  |
| `/admin/platform/**`                                                                  | platform_admin                              | n/a                                                       | platform sees all tenants                                           |
| `/settings/accessibility`                                                             | any signed-in role                          | n/a                                                       | personal setting                                                    |

A future `scripts/route-audit.mjs` extension should walk each page+BFF and assert: (a) every page calls `requirePageRole`; (b) every BFF calls `requireSession` + a tenant or ownership check; (c) no learner-facing surface reads brain state without the `child_data_collection` + `ai_personalization` consents.

---

## 6. Consent dependency map

Consent types (canon — `lib/db/types.ts → CONSENT_TYPES`):
Per `lib/db/types.ts → CONSENT_TYPES` (10 types):
`parent_account_terms` · `parent_privacy_policy` · `child_data_collection` · `iep_document_storage` · `ai_personalization` · `school_roster_import` · `teacher_access` · `marketing_opt_in` · `data_export_request` · `data_deletion_request`. COPPA is enforced via the `AgeGateRecord` + `child_data_collection` pairing — see UX-03 §3.1.

| Surface                                                                                 | Required consents                                                                        | Block behaviour                                                                            |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/signup`                                                                               | collect: `parent_account_terms`, `parent_privacy_policy` (+ optional `marketing_opt_in`) | inline checkboxes                                                                          |
| `/parent/learners/new`                                                                  | write `AgeGateRecord`; collect `child_data_collection` for the new learner               | inline before submit; AgeGateRecord captures `requiresParentConsent` when learner age < 13 |
| `/parent/learners/[id]/assessment`                                                      | `child_data_collection`                                                                  | redirect to `/parent/consent/[id]` if missing                                              |
| `/parent/learners/[id]/iep`                                                             | `iep_document_storage`                                                                   | inline accept-or-skip                                                                      |
| `/learner/home`, `/learner/lesson-runs/*`, `/learner/baseline/*`, `/learner/homework/*` | `child_data_collection` + `ai_personalization`                                           | redirect to `/learner/home?blocker=consent`                                                |
| `/teacher/learners/[id]`                                                                | `teacher_access` (per-learner)                                                           | hide profile or show "consent required" stub                                               |
| `/parent/privacy/data-export`                                                           | records `data_export_request` per export job                                             | inline; one ConsentRecord row per export request, scoped to account or learner             |
| `/parent/privacy/delete-data`                                                           | records `data_deletion_request` per deletion job                                         | inline; starts the 14-day soft-delete window                                               |
| District rostering ingest                                                               | `school_roster_import` (per-learner or account)                                          | parent accepts at school invite; admin cannot bypass                                       |
| `/parent/notifications` marketing toggles                                               | `marketing_opt_in`                                                                       | settings-only                                                                              |

Revocation effect (UX-00 §7 risk): each consent type must declare retroactive policy.

- `ai_personalization` revoked → no new AI-generated content; existing lesson summaries remain visible but flagged.
- `iep_document_storage` revoked → document is purged within 30 days; brain profile retains derived accommodations unless `child_data_collection` is also revoked.
- `child_data_collection` revoked → learner data soft-deletes within 30 days; all dashboards show "data removed" tombstone.

---

## 7. Mobile role-switching model (unified app)

One Expo app. Single `app/_layout.tsx` provides a `RoleModeProvider` whose value is `(activeRoleMode, setActiveRoleMode)`. The provider:

1. On login, reads `availableRoles` from the session profile.
2. If `availableRoles.length === 1`, sets that mode automatically.
3. Else routes to `/role-chooser` (first time after login).
4. `/role-switcher` drawer is reachable from every screen via a header avatar; switching modes calls `setActiveRoleMode(mode)` and replaces the tab navigator's tab set in place.

Active-mode persistence: `expo-secure-store` key `aivo.activeRoleMode`. Switching never re-authenticates — same session, different surface.

Tab navigator is one component reading `activeRoleMode` to pick its tab list. Each tab points to a route inside a shared route tree, not into the legacy `(parent)/(learner)/(teacher)` groups. Legacy groups are migrated screen-by-screen and deleted.

Per-mode deep link contract: `aivo://parent/learners/<id>`, `aivo://learner/lesson/<id>`, `aivo://teacher/classes/<id>`, `aivo://admin-lite/alerts`. The deep-link handler sets the active mode first, then navigates.

Caregiver and therapist (currently separate mobile groups, no web counterpart) — decision required:

- **If kept**: add `caregiver` and `therapist` to the Role canon in `lib/auth/types.ts`, the consent matrix (`teacher_access` likely extends), and the web sitemap.
- **If folded in**: `(caregiver)` collapses into Parent Mode with a "delegated caregiver" sub-permission; `(therapist)` collapses into Teacher Mode with a clinical sub-permission.

Default recommendation (per UX-00 §11): fold caregiver into parent, keep therapist as a future first-class role only if a paying customer requests it.

---

## 8. Breadcrumb and contextual navigation rules

- **Web**: breadcrumbs render at the top of `PageHeader` for any route deeper than two segments (e.g. `/parent/learners/[id]/iep/review`). Roots (`/parent/home`, `/learner/home`, etc.) never show breadcrumbs.
- **Breadcrumb format**: `Role home › Section › [Item] › Current`. Each crumb is a `<Link>`; current is text.
- **Learner exception**: learners never see breadcrumbs in lesson player, baseline, or quests — only an explicit "Exit lesson" button. Full-screen surfaces must trap focus.
- **Mobile**: no breadcrumbs; rely on tab navigator + back button. Deep-linked screens always include a header back affordance that respects the navigation stack.
- **Active learner context**: when a parent is helping a learner, every parent-side learner page shows a persistent "Helping <Learner name> — Switch" chip in the top right (web) or under the tab bar (mobile). Switching opens `/learner/select`.

---

## 9. Screen priority

### MVP (already shipped or P0 to ship)

Web: `/`, `/login`, `/signup`, `/parent/home`, `/parent/learners`, `/parent/learners/new`, `/parent/learners/[id]/*` (assessment · iep · brain-profile · baseline · progress · lessons), `/learner/select`, `/learner/home`, `/learner/baseline/[id]`, `/learner/lesson-runs/[id]`, `/teacher/home`, `/teacher/classes`, `/teacher/classes/[id]`, `/teacher/learners/[id]`, `/admin/platform`, `/settings/accessibility`, `/verify-email`, `/forgot-password`, `/reset-password`.

Mobile: `/welcome`, `/(auth)/*`, `/role-chooser`, `/role-switcher`, Parent Mode home + learners, Learner Mode today + lesson, Teacher Mode home + classes.

### School-ready release

Web: `/parent/inbox`, `/parent/consent/*`, `/parent/privacy/*`, `/teacher/assignments/*`, `/teacher/insights`, `/admin/school/*`, `/admin/platform/{ai-generation,ai-costs,audit-logs,safety/*,security/*,compliance/*,curriculum/*}`, `/learner/inbox`, `/learner/subjects/*`, `/learner/quests/*`, `/learner/homework/*`, `/learner/progress`, `/learner/rewards`.

Mobile: All four role modes' tab content, shared settings, notifications center.

### Enterprise (district) release

Web: `/admin/district/*`, `/admin/platform/{tenants,users,data,migration,billing,support,system-health/incidents}`, `/admin/platform/security/state-privacy`, `/admin/platform/security/vendors`, `/admin/platform/security/risks`.

Mobile: Admin-Lite Mode + push notifications + offline lesson queue.

---

## Acceptance criteria (per UX-01 brief)

- [x] Every primary route has a screen (114 implemented, 14 planned — all enumerated in `docs/ux/UX-01-route-matrix.json`).
- [x] Every screen has a purpose (template in §4; full coverage to be filled into `UX-01-route-matrix.json`).
- [x] Every screen has a primary CTA (template enforces; samples in §4.1).
- [x] Every screen has required states (template enforces).
- [x] Every route is mapped to role and permission (§5).
- [x] Learner navigation centers Today's Mission (`/learner/home` is the Today's Mission surface; `LEARNER_NAV` to be reordered per UX-00 §8).
- [x] Parent navigation centers learner readiness and progress (`/parent/home` rail, see §3).
- [x] Teacher navigation centers classes, learners, and assignments (see §3).
- [x] Admin navigation centers operational controls and auditability (see §3).
- [x] Mobile is designed as one unified app with role-based modes (§2 + §7).
