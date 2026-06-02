# UI Redesign Acceptance Matrix (Sprints 5–20)

This document is the release-polish punch list. Every primitive and surface
listed here ships against the soft-glass design language and the shared
seven-state component contract:

> `default | hover | focus | disabled | loading | error | empty`

The redesign is delivered in one branch
(`claude/parent-assessment-iep-upload-LTIvX`) — that branch name is
historical; it carries sprints 5 through 20 end-to-end.

## Sprint-by-sprint scorecard

| Sprint | Scope                                        | Deliverables                                                                                                                                                                                                                | Status |
| ------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **5**  | Parent assessment + IEP upload               | `@aivo/ui/assessment` (12 primitives); 11 calm screens; intro → step 1–11 → review → submitted → baseline-pending; IEP drag-drop + camera + extraction + per-support consent; `confirmIEPExtraction` repo; tests + showcase | ✅     |
| **6**  | Custom baseline experience                   | `@aivo/ui/baseline` (11 primitives); why → subjects → readiness → intro → runner; no-grades completion; calm break every BREAK_EVERY; ProctorBanner; parent/teacher summary; showcase                                       | ✅     |
| **7**  | Learner home + subject hub                   | `@aivo/ui/learner-home` (4 primitives: SubjectCard, TodayFocusCard, MessageCard, LearnerBottomNav); redesigned `/learner/home`, `/learner/subjects`, `/learner/subjects/[id]`; showcase                                     | ✅     |
| **8**  | AI tutor + lesson                            | `@aivo/ui/tutor` (6 primitives: TutorMessage, TutorInsightChip, ExplanationCard, PracticeCard, LessonStepper, VoiceInputButton); `/learner/tutor` home; showcase                                                            | ✅     |
| **9**  | Homework Helper                              | `@aivo/ui/homework` (2 primitives: HomeworkUploadCard, GuidedStepCard); redesigned `/learner/homework`                                                                                                                      | ✅     |
| **10** | Mastery + progress + analytics               | Redesigned `/learner/progress` + `/parent/reports` on existing `@aivo/ui/chart` primitives (SoftLine, DotChart, MasteryHeatStrip, ProgressCurve)                                                                            | ✅     |
| **11** | Teacher dashboard                            | Redesigned `/teacher/home` with LearningHero + 4-up insight grid + soft class roster                                                                                                                                        | ✅     |
| **12** | School + district admin                      | Redesigned `/admin/school` (6 calm operational cards) + `/admin/district` (FL distribution + platform health)                                                                                                               | ✅     |
| **13** | Curriculum + skill graph + lesson generation | `@aivo/ui/curriculum` (2 primitives: SkillNodeCard, LessonPreviewCard); `/teacher/lesson-plans` now surfaces source citations + accommodation chips + approval-state ribbon                                                 | ✅     |
| **14** | Quests + motivation                          | Redesigned `/learner/quests` — calm dot-strip per-world progress; no badges, no loot boxes                                                                                                                                  | ✅     |
| **15** | Messaging, notifications, approvals          | Redesigned `/parent/notifications` — 3-up metric strip + reassurance column + soft delivery-preferences card                                                                                                                | ✅     |
| **16** | Billing                                      | Redesigned `/parent/settings/billing` — clear status, soft invoice list, dignified payment-failed handling                                                                                                                  | ✅     |
| **17** | Accessibility + neurodiverse layer           | Redesigned `/learner/settings/accessibility` with AICompanionHero + reassurance ("same product, no labels"); existing AccessibilityForm preserved                                                                           | ✅     |
| **18** | Mobile app                                   | Two new `@aivo/mobile-ui` primitives (MobileSubjectCard, MobileLearningHero) mirroring the web learner home; role-aware shell already in place from sprint 3                                                                | ✅     |
| **19** | Empty + error + loading + offline states     | `@aivo/ui/states` extended (StateCard 11 kinds, AIGenerationStatusCard 7 kinds, OfflineBanner 2 variants); `/design-system/states` showcase                                                                                 | ✅     |
| **20** | Final integration + QA + polish              | Lint-clean across `apps/web-v2`; typecheck-clean; `@aivo/ui` builds clean; legacy hex fallbacks stripped from sprint-3 onboarding pages; this acceptance matrix doc                                                         | ✅     |

## Coverage by acceptance criteria

### Typography + radius + spacing

Every new primitive consumes the `@aivo/brand` token CSS variables via
`bg-[var(...)]` Tailwind arbitrary values — never hex literals — and uses
the `rounded-iw-*` radius scale. The repo ESLint rule
`no-restricted-syntax` enforces this in `apps/web-v2` and
`apps/marketing` builds. As of sprint 20 the lint passes clean.

### Soft-glass surfaces

Every dashboard panel composes on `Surface/GlassCard` or one of the
domain shells (`AssessmentShell`, `LearnerBaselineShell`,
`AICompanionHero`). No raw `Card` from the legacy
`@/components/ui/card` is introduced in any sprint-5+ surface.

### Charts

Chart primitives (sprint 1) are reused across sprint 10 dashboards — no
new chart libraries; SVG math stays in `chart/helpers.ts`.

### Icons + buttons

Action rows always render via `AssessmentFooter`,
`LearnerBaselineShell.bottomBar`, or explicit `Link` / `button`
elements styled with `rounded-iw-control` + the canonical purple CTA.
Icon glyphs are inlined SVG to keep bundle size flat — no
`lucide-react` adds inside the new primitive code.

### Navigation clarity

`LearnerBottomNav` (sprint 7) is the canonical mobile-web bottom nav.
Web role shells continue to use the existing `@aivo/ui/shell` from
sprint 2.

### Accessibility

Every primitive exposes the expected ARIA contract:

- `role="progressbar"` + `aria-valuenow` on every progress dot strip
- `role="status"` / `role="alert"` + `aria-live` on AI generation and
  error cards
- `aria-pressed` on toggle buttons (ReadAloudButton, VoiceInputButton)
- `aria-current="step"` on the active step in stepper primitives
- `aria-busy` on in-flight loading surfaces
- All radio + checkbox controls use native semantic inputs (form-only
  submission works without client JS).

### Role-aware content

Every redesigned route honours the existing `requirePageRole` guard;
the `ProctorBanner` makes the parent-as-learner shadow mode explicit
across baseline + lesson flows.

### Empty / loading / error states

Every workflow has the four states wired: sprint 19's
`@aivo/ui/states` library is consumed by sprints 5–17 surfaces where
appropriate, and the `/design-system/states` showcase locks down the
visual contract.

### Mobile responsiveness

Every redesigned web route uses the same breakpoint vocabulary
(`sm:`, `md:`, `lg:`). The single mobile app has soft-glass
counterparts via `@aivo/mobile-ui`.

### No dead links / no placeholder data

Every CTA in the redesigned routes resolves to a real downstream page
or a server action. The teacher home's "Connect roster" button
remains disabled (waiting on rostering integration) but never sits as
a dead link.

### No mock-question language

The sprint 5 → 6 handoff specifically rewrote every learner-facing
string to never use the word "mock" or imply generic content. The
`AICompanionHero` body text and `PersonalizationChip` variants
("Personalized from parent assessment", "IEP supports applied",
"Pacing adjusted", "No grades — this helps AIVO learn") prove
personalization is real.

## Showcases

| Route                         | Renders                                       |
| ----------------------------- | --------------------------------------------- |
| `/design-system`              | Core primitives (sprint 1)                    |
| `/design-system/shell`        | Shell primitives (sprint 2)                   |
| `/design-system/assessment`   | Parent assessment + IEP primitives (sprint 5) |
| `/design-system/baseline`     | Baseline learner primitives (sprint 6)        |
| `/design-system/learner-home` | Learner home + subject hub (sprint 7)         |
| `/design-system/tutor`        | AI tutor + lesson primitives (sprint 8)       |
| `/design-system/states`       | Empty / error / AI in-flight (sprint 19)      |

## QA checklist (release readiness)

- ✅ `pnpm --filter @aivo/ui run build` — clean
- ✅ `pnpm --filter @aivo/brand run build` — clean
- ✅ `pnpm --filter @aivo/web-v2 run typecheck` — clean
- ✅ `pnpm --filter @aivo/web-v2 run lint` — clean (sprint 20 swept
  legacy hex fallbacks)
- ⚠️ `pnpm --filter @aivo/web-v2 run test` — 14/15 passing; one
  pre-existing `env.test.ts` failure unrelated to sprint 5–20 work
  (vitest sets `NODE_ENV=test`, the test asserts `"development"`).
