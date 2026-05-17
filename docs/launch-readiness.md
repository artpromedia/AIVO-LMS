# AIVO v3 Launch Readiness Checklist

## Sprint 1 — Multi-tenant Foundation
- [x] Multi-tenant data model with `tenantId` on all sensitive tables
- [x] Safety gate (content moderation hooks before any AI generation reaches a learner)
- [x] CORS allow-list configured per environment
- [x] Identity service with role hierarchy (PLATFORM_ADMIN, DISTRICT_ADMIN, TEACHER, THERAPIST, CAREGIVER, PARENT, LEARNER)

## Sprint 2 — CI & Coverage
- [x] CI lint step is blocking on PRs
- [x] CI typecheck step is blocking
- [x] Test coverage thresholds enforced for safety-critical packages
- [x] Accessibility lint workflow (jsx-a11y) wired into CI

## Sprint 3 — Content Moderation Pipeline
- [x] Pre-generation prompt scanning
- [x] Post-generation output moderation
- [x] Audit log for moderation decisions
- [x] Manual review queue surfaced in admin dashboard

## Sprint 4 — Adaptive Learning Paths
- [x] Multi-signal XP (accuracy, persistence, mastery, exploration)
- [x] Mastery-gated advancement between stages
- [x] Functioning-level-aware lesson generation (5-tier model)
- [x] XAI explanation surface for every brain decision

## Sprint 5 — Parent Dashboard
- [x] Parent dashboard with learners, progress, IEP, sessions, recommendations
- [x] Brain profile view per child with explanation history
- [x] Co-learn and team coordination pages
- [x] Tutor catalog and session scheduling

## Sprint 6 — Security Hardening
- [x] MFA-forced UI for elevated roles (PLATFORM_ADMIN, DISTRICT_ADMIN, TEACHER, THERAPIST)
- [x] Global JWT-or-service-token auth hook on learning-svc and tutor-svc
- [x] `requireLearnerAccess` tenant guard on every learner-scoped route
- [x] Internal `x-service-token` propagation across brain-svc, tutor-svc, learning-svc
- [x] Database SSL warning on production startup with case-insensitive, query-bounded regex
- [x] CI security gates: `pnpm audit`, `pip-audit --strict`, Trivy, TruffleHog, Bandit, summary aggregator
- [x] `docs/security-architecture.md` with sensitive-PII column inventory

## Sprint 7 — Production Readiness & Polish
- [x] eslint-plugin-jsx-a11y integrated in web app with passing lint
- [x] Status page tracks per-service response time and warns on slow checks (>2s)
- [x] Admin alert dispatched after 3 consecutive down-checks (cooldown enforced)
- [x] `x-request-id` propagation helpers in `@aivo/observability`
- [x] Coming-soon connectors carry explicit `status: "coming_soon"` field
- [x] `POST /api/integrations/waitlist` endpoint collects district interest
- [x] District integrations UI shows "Notify me when available" CTA for coming-soon connectors
- [x] End-to-end smoke test specs for parent onboarding, learner session, brain review
- [x] `docs/architecture-overview.md` with service diagram and data flow
- [x] `docs/mobile-parity.md` audit matrix
- [ ] COPPA Safe Harbor enrollment verification (pre-launch requirement; see Compliance section)

## Accessibility (WCAG 2.1 AA)
- [x] SkipLink component on all dashboard layouts
- [x] Sidebar navigation with proper ARIA roles and labels
- [x] `aria-current="page"` on active nav links
- [x] `aria-hidden="true"` on decorative emoji icons
- [x] AccessibleToggle component with `role="switch"`
- [x] Focus-visible outlines globally (purple ring, 2px offset)
- [x] `prefers-reduced-motion` support in globals.css
- [x] Error alerts with `role="alert"` and `aria-live="assertive"`
- [x] Loading states with `role="status"` and `aria-live="polite"`
- [x] Login/signup: password toggle aria-labels, submit aria-busy
- [x] BrainVisualization: region role, SVG aria-label
- [x] Stage assessment: answer feedback live region, choice aria-labels
- [x] Breadcrumb navigation with aria-label
- [x] Notification button aria-expanded + unread count
- [x] eslint-plugin-jsx-a11y rules enforced (zero violations on `pnpm lint`)
- [x] Playwright a11y test suite (axe-core) for login, signup, dashboards, parent, learner stage
- [ ] i18n accessibility verification (screen reader tested in EN + ES) — manual pre-launch task
- [ ] Full keyboard navigation audit — manual pre-launch task
- [ ] VoiceOver/NVDA manual testing pass — manual pre-launch task

## Compliance (pre-launch)
- [ ] **COPPA Safe Harbor**: verify enrollment status with current Safe Harbor program
      (e.g. iKeepSafe, kidSAFE). Marketing site references Safe Harbor — claim must be
      accurate at launch or removed. Owner: Compliance.
- [ ] FERPA data-handling agreement sign-off with pilot districts
- [ ] State-specific student-data privacy contracts (e.g. NY Ed Law 2-d, CA SOPIPA) reviewed
- [ ] Pen-test or third-party security review scheduled

## Documentation
- [x] Accessibility guidelines (`docs/accessibility-guidelines.md`)
- [x] Launch readiness checklist (this file)
- [x] Security architecture (`docs/security-architecture.md`)
- [x] Architecture overview (`docs/architecture-overview.md`)
- [x] Mobile parity matrix (`docs/mobile-parity.md`)
- [x] PR template (`.github/PULL_REQUEST_TEMPLATE.md`)
- [x] API reference: each service exposes Swagger UI at `/docs`
