# AIVO Assessment Experience & Learning Brain Audit

**Scope:** The assessment suite (parent, teacher, caregiver, therapist, learner baseline), multi-source orchestration, and the Learning Brain visualization + parent approval flow.
**Method:** Read-only code audit of `apps/web-v2`, `apps/mobile`, `services/assessment-svc`, `services/brain-svc`, `services/family-svc`, `services/comms-svc`, and shared packages. The app was **not** run in this environment (no database/services were started), so there are no screenshots; all evidence is code-level with `file:line` citations. Anything that could not be verified from code is marked **❓ Unverified**.
**Date:** 2026-06-12

---

## A note on architecture that shapes every finding

The product has **two parallel implementations** of the assessment-to-brain pipeline, with materially different guarantees:

1. **The web-v2 stack** — Next.js app with its own persistence layer (`apps/web-v2/lib/db/repos.ts`, drizzle adapters in `lib/db/persistence/`). This is the live product surface for the parent/learner journey audited here.
2. **The microservices stack** — `assessment-svc` (Fastify), `brain-svc` (Python/FastAPI), `family-svc`. Mobile and some BFF routes proxy to these.

These stacks duplicate the brain-clone, approval, consent, and collaborator-insight logic — and they **disagree**: the Python `brain-svc` approval endpoint enforces COPPA consent and Responsible-AI acknowledgement (`services/brain-svc/src/brain_svc/routes/brain.py:330-346`), while the web-v2 approval action enforces neither (`apps/web-v2/app/parent/learners/[learnerId]/brain-clone-watch/page.tsx:36-52`). Several "Below bar" findings in this report are not missing features — they are features that exist in one stack and not in the one the user actually touches.

---

# 1. Executive Summary

| # | Flow | Verdict |
|---|------|---------|
| 1 | Parent assessment | **Approaching enterprise-grade** — the strongest flow in the suite; warm, strengths-first, accessible. Gaps are mechanical (autosave transparency, resume signal), not conceptual. |
| 2 | Teacher input/assessment | **Below bar — the flow does not exist as an experience.** Two complete backends (`teacher_assessments`, `teacher_insights`→`brain_insights`) have **zero frontend UI**. |
| 3 | Caregiver input | **Approaching** — a competent, low-friction ABC observation log; but it is an ongoing log, not an assessment, and it lacks examples, editing, and announced success. |
| 4 | Therapist input/assessment | **Approaching** — credible clinical fields and a real form, but a single undifferentiated card with no autosave, no time estimate, no IEP context, and no professional summary artifact. |
| 5 | Learner baseline ("Discovery Adventure") | **Approaching enterprise-grade, enterprise-grade on emotional safety** — genuinely impossible to "fail," untimed, break-aware, frustration-adaptive. Falls short on switch/AAC access and honoring font/spacing preferences inside questions. |
| 6 | Multi-source orchestration | **Below bar** — invitations work and are well-secured, but there is no completion-tracking hub, no automatic reminders, raw `PENDING`/`ACCEPTED` enums in the parent UI, and no signal when the brain builds without a contributor's input. |
| 7 | Learning Brain visualization + approval | **Approaching on spectacle, Below bar on substance** — a cinematic WebGL reveal exists and the learner-side "Awakening" is the best moment in the product; but the approval gate is not enforced server-side in the live stack, the correction loop is a dead end, the mobile approve button does nothing, and the reveal makes claims the backend cannot back up. |

### The three things that most undermine parent trust today

1. **The approval gate is theater in the shipped stack.** The web-v2 lesson pipeline creates the learning path at baseline completion — *before* approval (`apps/web-v2/lib/db/repos.ts:1378-1421`) — and `createLessonRun` only checks that a brain profile *exists*, not that it is approved (`repos.ts:1885-1892`), then teaches from it (`brainStateSnapshot: brain.state`, `repos.ts:1945`). `pickTodaysMission` never consults approval (`apps/web-v2/lib/learner/today.ts`). On mobile, the "Approve profile" button literally does not approve — it navigates to a recommendations screen (`apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx:181-192`). The product's central promise — "nothing teaches from the brain until you approve it" — is currently a UI routing convention, not a guarantee.
2. **The trust moment makes claims the code can't honor.** During the build animation the parent is shown "Encrypted (AES-256)" and "No personal data leaves this device unencrypted" (`apps/web-v2/lib/i18n/messages/en.json` → `building_activation_encrypted`, `clone_privacy_pii`); no AES-256 encryption of brain state exists anywhere in the codebase (the only AES-256 usages are integration credentials, speech transcripts, and MFA secrets). The same screen renders a fabricated grade-equivalent ("Level: grade 3.0 · Gap: 3yr") computed as `score × enrolledGrade` (`apps/web-v2/components/brain/brain-building-sequence.tsx:96-98, 279-301`) — pseudo-psychometrics presented in deficit framing at the emotional peak of the reveal.
3. **The correction loop is broken.** "Add context & rebuild" routes to a **read-only** profile page with no editing controls (`brain-clone-watch/building-client.tsx:244-249` → `brain-profile/page.tsx`); its only action, "Regenerate," silently resets the clone to `pre_clone` and strands the parent (`repos.ts:564-576`). Field-level corrections ("actually, she's fine reading aloud") exist in the Python API (`brain.py:382-411`, `parent_modifications`) but have no UI anywhere. Declining the brain in the Python stack **deletes the child's entire baseline work** (`brain.py:624-631`).

---

# 2. Scorecard

Scale: 1 = prototype, 3 = enterprise baseline, 5 = best-in-class. Scored against each flow's persona bar (Typeform / Headspace / 23andMe-Wrapped / Khan Academy Kids).

| Flow | Craft | Emotional fit | Accessibility | Completion friction | Trust & privacy |
|---|---|---|---|---|---|
| **1. Parent assessment** | **4** — 11-screen wizard, per-step validation, review screen; step 10 crams 3 sections | **4** — "There's no wrong answer here"; strengths before challenges; clinical diagnosis labels are the only wobble | **4** — full ARIA on every form primitive (`packages/ui/src/assessment/*`); ❓ no automated axe evidence found for these routes | **4** — 6-min estimate up front, per-step time-left; autosave only on Next, weak resume signal | **4** — "What learners never see" disclosure; tenant-scoped writes |
| **2. Teacher** | **1** — no UI exists | **1** — nothing to feel | **1** — n/a | **1** — flow cannot be completed | **2** — backend role checks are sound (`teacher-assessment.ts:60-83`) but unused |
| **3. Caregiver** | **3** — clean ABC form, immediate list confirmation; no edit/undo, no examples | **3** — plain parentheticals ("what came before?"); forgiving; but zero warmth copy | **2** — labels present, but no `aria-live` on success/error, silent refresh-on-success | **4** — sub-3-minute, only 2 required fields | **3** — backend verifies caregiver link; BFF POST lacks learner-scope check (`api/bff/caregiver/observations/route.ts`) |
| **4. Therapist** | **3** — correct clinical fields, all-optional; single flat card, no draft state | **3** — professional, respectful; success copy explains impact | **2** — minimal ARIA; error not associated to fields | **3** — short form, but no time estimate, no autosave for a between-sessions professional | **3** — caseload-gated at page, BFF, and service (`therapist-assessment.ts:59-97`) |
| **5. Learner baseline** | **4** — adaptive 1-PL w/ SE stop, frustration ceiling, breaks, resume; AI-item safety gate w/ vetted fallback | **5** — "Nothing here is a test", "No clock", skip everywhere, tutor characters, no visible failure — meets the Khan Kids bar in copy and mechanics | **3** — read-aloud everywhere, sensory mode wired; **no switch/AAC path**, font/spacing prefs not applied in question card | **4** — 3 calm pre-steps, resume mid-run; pre-steps could compress | **4** — child never sees scores; safety gate audits every shipped item |
| **6. Orchestration** | **3** — invites, hashed single-use tokens, auto-accept, revoke; no hub | **2** — functional emails; raw `PENDING` badges to parents (`team-invite-section.tsx:228-229`) | **2** — ❓ accept-invite a11y not deeply assessed | **2** — no reminders, no completion tracking, contributor may never know what happened to their input | **3** — strong role-scoped brain views in family-svc (`collaboration.ts:745-891`); undermined by web-v2 BFF full-profile exposure (below) |
| **7. Learning Brain** | **3** — three-act cinematic with WebGL sphere and reduced-motion fallbacks; recap is a settings list; amend dead-ends | **3** — learner Awakening is a 5; parent flow leads with grade gaps and "System activation" jargon | **3** — `aria-live` stage region, reduced-motion honored end-to-end (`building-client.tsx:106-118`); sphere has aria-label | **3** — approve gated only on animation finishing; mobile approve non-functional | **2** — no server-side teach-gate (web), unscoped brain-svc reads/rollback, unverifiable encryption claims |

---

# 3. Findings per flow

## 3.1 Parent assessment — Approaching enterprise-grade

**Route map:** `/parent/learners/[learnerId]/assessment/intro` → `?step=1..11` → `/review` → `/submitted` (`apps/web-v2/app/parent/learners/[learnerId]/assessment/`). Steps defined in `apps/web-v2/lib/validators/parent-assessment.ts:143-241`; persisted per-section to `web_parent_assessments` via server action (`assessment/page.tsx:93-245`).

**Strengths (evidence):**
- **Warmth that meets the Headspace bar.** "There's no wrong answer here" (strengths helper), "Short focus windows and frequent breaks are common and fine," "Every learner is different. AIVO honours whatever you select" (`assessment/page.tsx:166, 190, 198`). The intro promises "About 6 minutes · Eleven calm screens" (`assessment/intro/page.tsx:32-34`).
- **Strengths-first sequencing.** Step 2 is "What does your child love and do well?" *before* Step 3's challenges (`lib/validators/parent-assessment.ts:160-167`).
- **"Why we're asking" on every step**, plus dynamic ReassuranceColumn cards ("Why we ask this" / "What this changes") (`assessment/page.tsx:427-474`).
- **Accessible primitives throughout**: `role="progressbar"` with values (`packages/ui/src/assessment/AssessmentProgress.tsx:54-59`), `fieldset`/`legend` with sr-only native inputs (`PillCardGroup.tsx:120-156`), `aria-describedby`/`aria-invalid` wiring (`SoftTextField.tsx:94-112`).
- **Completion screen closes the loop**: "Thanks — AIVO is set up for {name}", concrete next steps, and a "What learners never see" privacy card (raw IEP, diagnoses, your answers) (`assessment/submitted/page.tsx:64-165`).

**Weaknesses (evidence):**
- **Autosave is step-commit, not continuous.** Saving happens only on the Next/Save button POST (`assessment/page.tsx:93-245`); a battery death mid-step loses the current screen. No "Saved ✓" confirmation anywhere — for an anxious parent at 11pm, the absence of an explicit save signal is the difference between confidence and re-typing.
- **Resume is functionally correct but invisible.** Returning parents land on the intro with a "Continue where I left off" button (`intro/page.tsx:162-187`) — no "7 of 11 complete" badge, no preview that answers survived.
- **Step 10 violates one-thought-at-a-time**: homework + goals + motivation (7 inputs) on one screen (`assessment/page.tsx:931-979`).
- **Diagnosis checklist is the one clinical moment**: raw labels ("ADHD", "Autism spectrum", `page.tsx:349-359`) softened by "leave blank if you'd rather not say" — adequate, but the softening reassurance ("AIVO doesn't need a formal label") appears at the sensory step, not here.
- ❓ **Mobile parity unverified**: the mobile app has its own onboarding (`apps/mobile/app/(parent)/onboard.tsx`) but no full parent-assessment wizard found; mobile-first parents likely complete this on responsive web.

**Best-in-class would add:** field-level debounced autosave with a visible "Saved" tick; a resume card on the learner page ("You're 70% through — 2 minutes left"); splitting step 10; a one-line "you can change any of this later" near the diagnosis grid.

## 3.2 Teacher input — Below bar (does not exist)

- Backend route and table are complete and well-permissioned: `POST /api/assessments/teacher` accepts strengths/challenges/accommodations/focus areas, requires an ACCEPTED `learner_teachers` link (`services/assessment-svc/src/routes/teacher-assessment.ts:60-83, 146-217`; schema `packages/db/src/schema/assessments.ts:80-108`).
- A second channel exists: `POST /api/family/teacher-insights` "writes to the dedicated `teacher_insights` table and mirrors into `brain_insights`" (`apps/web-v2/lib/bff/family-svc.ts:195-202`), proxied at `apps/web-v2/app/api/bff/teacher/insights/route.ts` — **no page or component calls it** (repo-wide search returned only the route file itself).
- The teacher app shell has no assessment entry: `apps/web-v2/app/teacher/` contains assignments, classes, insights (a **read-only** mastery dashboard — `teacher/insights/page.tsx`), IEP draft, reports — no assessment route.
- Consequence: the brain clone's collaborator fold (`repos.ts:627`, `clone_pipeline.py:144-212`) reads a table (`brain_insights`) that **no teacher-facing UI in web-v2 can write to**. The multi-source story is structurally incomplete for its most common contributor.
- ❓ Unverified whether `apps/web-admin` or another surface exposes teacher insight submission; no references found.

**Best-in-class:** a 6-minute, 5-screen teacher flow reachable from the invite email in one click — pre-authenticated by token, autosaving, framed in school constructs ("Which accommodations are already in her IEP working?"), ending with "Done in 4:32 — here's what AIVO will do with this."

## 3.3 Caregiver input — Approaching

- The flow is an ongoing ABC observation log, not a one-time assessment: `/caregiver/observations` (`apps/web-v2/app/caregiver/observations/page.tsx`, form at `observation-form.tsx`).
- **Plain language is genuinely good for ESL caregivers**: "Antecedent (what came before?)", "Behaviour (what did you see?)", "Describe the behaviour briefly" (`lib/i18n/messages/en.json:3109-3129`). Only learner + behaviour required (`observation-form.tsx:36-39`).
- **Gaps:** no example observations to anchor the ABC concept for untrained caregivers; observations are immutable post-submit (no edit/undo — Nielsen #3 user control); success is a silent `router.refresh()` with no `aria-live` announcement (`observation-form.tsx:52`); no draft persistence on network failure; the schema's `mood` field exists (`packages/db/src/schema/collaboration.ts:134`) but the form never exposes it.
- **There is no caregiver *assessment*** equivalent to the teacher/therapist instruments — caregivers contribute only ambient observations. ❓ Whether this is intentional product design or a gap could not be determined from code or docs.

**Best-in-class:** 2-3 worked examples inline ("Example: Refused to hold the pencil → accepted with hand-over-hand"); a gentle optional mood picker; edit-within-15-minutes; announced success ("Saved — thank you, this helps AIVO see patterns").

## 3.4 Therapist input — Approaching

- Real flow: `/therapist/learners/[learnerId]/assessment` (`apps/web-v2/app/therapist/learners/[learnerId]/assessment/page.tsx`), `TherapistAssessmentForm` (`components/therapist/therapist-assessment-form.tsx`), BFF proxy with caseload verification, service route requiring ACCEPTED `learner_therapists` link (`therapist-assessment.ts:59-97`).
- **Clinical credibility is solid**: discipline dropdown (speech/OT/behavioral/physical), "regulation strategies that work," "recommended accommodations," sensory/communication notes (`en.json:3050-3073`). All fields optional — "Everything is optional" respects clinical judgment, and therapist insights are folded as **non-removable** accommodations in the clone ("a clinician flagged it") vs. removable for teacher/caregiver (`clone_pipeline.py:167-203`) — a genuinely thoughtful evidence-weighting design.
- **Gaps:** single flat card with no progress/pacing; **no autosave or draft** (state is local — a tab crash loses everything, `therapist-assessment-form.tsx:28-37`); no time estimate; no IEP goals visible alongside the form (forced context-switch); success is an inline box ("Your input now feeds this learner's baseline and lesson personalization") with **no reviewable record of what they submitted** — a clinician documenting input into a child's profile should get a timestamped summary; no session-context fields (date observed, frequency).
- **IEP upload** (parent/teacher side): 10 MB PDF cap with friendly 413 (`services/assessment-svc/src/routes/iep.ts:408-412`), pdf-parse extraction, ai-svc `parse-iep` with graceful raw-text fallback (`iep.ts:440-488`), and deliberate redaction — teachers see only `teacherSummary` + accommodations, never raw IEP text (`teacher/learners/[learnerId]/page.tsx:154-173`). **No virus scanning of uploads found** ❓ (may exist at infra layer).

**Best-in-class:** autosaving draft with "last saved" timestamp; the learner's active IEP goals rendered read-only beside the form; a post-submit professional summary page ("Submitted 2026-06-12 · Speech · 3 strengths, 2 accommodations recommended") that doubles as their record.

## 3.5 Learner baseline — Approaching enterprise-grade; enterprise-grade emotional safety

**Journey:** `/learner/baseline` → `/why` → `/subjects` → `/readiness` → `/intro` → `/[baselineId]` run → completion (all under `apps/web-v2/app/learner/baseline/`).

**Strengths (this flow earns its calibration bar):**
- **No-fail framing in every screen's actual copy**: "Nothing here is a test" (readiness), "No grades, no points," "Breaks are good," "Skip anything you don't want to try," "There's no clock anyway. Take all the time you need," hint card: "AIVO knows you used a hint — that's normal and helpful. No grade penalty." Completion: "Thanks, {name} — that's plenty for AIVO to start. There are no grades here." Correct/incorrect is **never** shown mid-run; `showAnswered` defaults to false on the learner view (`packages/ui` CompletionHero).
- **Adaptive kindness in the mechanics, not just the copy**: 1-PL IRT with SE-stop; prior θ seeded from parent-reported comfort (`lib/learner/baseline-adaptive.ts:176`); a frustration ceiling that tightens after 2-3 consecutive misses so the engine *cannot* serve a too-hard item (`baseline-adaptive.ts:232-276`); breaks every 5 questions **or** on struggle streak (`baseline/[baselineId]/page.tsx:405-461`); 45s+ latency escalates frustration.
- **Tutor characters present throughout**: six named tutors with landmarks ("Nova · Number Galaxy"), avatar on every question header (`lib/learner/baseline-tutors.ts:39-108`).
- **AI-item safety gate**: every LLM-generated item passes a Responsible-AI evaluator; blocked items are swapped with vetted bank items and every shipped item is audited (`services/assessment-svc/src/services/baseline-safety-gate.ts`).
- Resume after abandonment reconstructs θ from stored attempts (`baseline-adaptive.ts:195-224`).

**Weaknesses:**
- **No switch access or AAC input path in the baseline** — no switch-adapter/scanning integration anywhere under `app/learner/baseline/` despite the platform shipping an `aac-bridge` package and supporting `switch_access`/`eye_gaze` in functioning-level derivation (`clone_pipeline.py:95-101`). The learners the product centers most cannot take the baseline independently.
- **`packages/accessibility-contract` is never imported by baseline components**; font/letter-spacing/text-size accessibility defaults are not applied to the question card (hardcoded `text-2xl md:text-3xl`).
- **Mobile baseline is out of sync**: hardcoded subjects and `BREAK_EVERY = 3` vs. web's 5 (`apps/mobile/app/(learner)/baseline/`).
- Breaks appear without explanation — fine for most kids, but "we noticed some tricky ones, let's breathe" would turn an opaque interruption into co-regulation.
- ❓ Loading state during LLM chapter generation: no explicit child-facing "making your next questions" experience found; latency handling appears to be a plain fetch.

**Best-in-class:** wire the accessibility contract into the question card; add a switch-scanning mode; sync mobile; give the tutor one line of encouragement at break/resume moments.

## 3.6 Multi-source orchestration — Below bar

**What works:**
- Parent→{teacher,caregiver,therapist} invites with rate limiting (10/hr, 50/day), auto-accept for existing accounts (`services/family-svc/src/routes/collaboration.ts:339-593`); teacher→parent invites use SHA-256-hashed, single-use, 72-hour tokens (`collaboration.ts:1428-1615`, schema `packages/db/src/schema/collaboration.ts:143-175`).
- Email copy is serviceable and safe: "{inviter} invited you to {learner}'s learning team… If you weren't expecting this invitation, you can safely ignore this email" (`services/comms-svc/src/lib/templates.ts:134-150, 388-407`).
- Accept-invite handles the wrong-account case with an explicit message ("You're signed in as X, but this invitation is for Y" — `apps/web-v2/app/accept-invite/page.tsx`).
- Role-scoped brain views in family-svc are genuinely good privacy engineering: teacher sees mastery/accommodations but not disability signals; caregiver sees only aggregates; therapist gets the HIPAA-scoped view (`collaboration.ts:745-891`).
- Revocation exists (`collaboration.ts:596-642`).

**What's missing (each verified absent):**
- **No completion-tracking hub.** The parent team section shows raw status enums as badges (`ACCEPTED`/`PENDING` — `apps/web-v2/app/parent/learners/[learnerId]/team/team-invite-section.tsx:228-229`); nothing anywhere shows "Ms. Rivera accepted but hasn't shared input yet."
- **No automatic reminders.** comms-svc has billing and IEP-review reminder jobs but no invite-expiry or assessment-nudge job; resend is manual-API-only (`collaboration.ts:1241-1360`).
- **No partial-data signal.** The clone proceeds without contributors by design (good resilience — `clone_pipeline.py:144-164` returns `[]` on any error), but the parent is never told "this profile was built without teacher input" and nothing in the brain UI distinguishes a 1-source profile from a 4-source one.
- **Consent is split across two systems.** Web-v2 has a real under-13 consent regime — age gate + per-type `ConsentRecord` (`child_data_collection`, `teacher_access`, `ai_personalization`) captured at onboarding (`apps/web-v2/app/onboarding/child-approval/page.tsx:42-118`) and enforced on data routes via `requireLearnerConsent` (`apps/web-v2/lib/bff/consent-guard.ts:25-62`), with hashed-IP evidence. family-svc's `consentRecords` is by contrast a generic string-typed table with a frozen `"1.0"` version. **No FERPA disclosure log** (who viewed which child's record) exists in either stack.
- **No notification to a contributor that their input mattered** ("Your observations shaped Maya's reading plan") — the single highest-leverage retention loop for teachers/therapists, absent.

## 3.7 Learning Brain — detailed in §4.

---

# 4. Learning Brain deep dive

## 4.1 Current state against the eight points

### 1. Existence — ✅ Yes, three surfaces
- **Parent (web):** `/parent/learners/[learnerId]/brain-clone-watch` — a three-act experience: master→child clone animation → cinematic build sequence → recap timeline with Approve/Amend (`brain-clone-watch/page.tsx`, `building-client.tsx`, `components/brain/brain-building-sequence.tsx`, WebGL `pixi-brain-sphere.tsx`).
- **Parent (mobile):** `apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx` — stage list + XAI chips.
- **Learner:** `/learner/brain-clone/[learnerId]` "Awakening" (`page.tsx` + `awakening-client.tsx`) — plays once between `cloned` and `approved`.
- Also a static profile page `/parent/learners/[learnerId]/brain-profile` (read-only data cards).

### 2. Transparency — Partial; the plumbing exists, the panel was never built
- Coarse source attribution exists: the XAI summary is literally "Clone built from submitted parent assessment + IEP + completed baseline + N collaborator insight(s)…" (`lib/learner/brain-profile.ts:589-594`), and per-decision reasoning strings carry sources — e.g. `"therapist insight (communication): <snippet>"`, `source: "collaborator:therapist"` (`brain-profile.ts:134-135`, mirrored in `clone_pipeline.py:193-211`).
- Confidence is three booleans + a count (`confidenceSignals: { parentAssessment, iep, baselineAttempts }`, `brain-profile.ts:648-652`) — **no per-inference confidence levels** anywhere.
- The Sprint A1 explainability selector exists with RAI disclosures, bias-mitigation statements, and a humanOversight line ("This brain clone requires parent approval before activation" — `lib/learner/brain-explainability.ts:59-68`), **but `BrainExplainabilityPanel` (Sprint A2) was never built**: the symbol appears only in types and the selector; no component renders it. The recap timeline shows truncated decision strings and, in the "paths" stage, **raw tutor slugs as labels** (`brain-clone-watch/page.tsx:228-233`).
- The "you told us X, her teacher observed Y, the baseline showed Z" narrative the product needs is therefore *assembled in data and never told on screen*.

### 3. Strengths-first — ❌ on the parent side, ✅ on the learner side
- The build sequence's stage order is template → **domains** → accommodations → activation → tutors (`brain-building-sequence.tsx:68-75`). The domains stage is the second thing the parent sees, and it renders per-subject bars with "Level: grade {x} · Enrolled: grade {y} · **Gap: {z}yr**" in warning-amber (`brain-building-sequence.tsx:279-301`, copy `building_gap` in `en.json`). There is **no strengths stage**. For the parent of a struggling learner, the reveal opens with a row of deficit cards — precisely the report-card moment the experience must never be.
- The learner Awakening, by contrast, is strengths-led: its "memories" phase is powered by the child's *strongest* subjects (`learner/brain-clone/[learnerId]/page.tsx:47-53`), and the narration is excellent: "Every adventure you just had is becoming part of you… The moments you shone brightest are now part of your brain forever… This is your brain. It will grow with you." (`en.json` `awakening_narration_*`).
- The brain-profile page uses qualitative estimates ("growing", "confident") rather than scores — good — but leads with system metadata (AI-generated badge, schema version) rather than the child.

### 4. Scientific honesty — ❌ Multiple overclaims at the trust moment
- **Fabricated psychometrics:** `scoreToGradeEquiv(score, enrolled) = score × enrolledGrade` (`brain-building-sequence.tsx:96-98`). A 0.5 mastery for a 6th-grader is displayed as "grade 3.0 / Gap: 3yr." Multiplying a normalized score by enrolled grade is not a grade-equivalent estimate by any psychometric standard; presenting it with one-decimal precision manufactures false certainty about the most sensitive number a parent will ever read here.
- **Unbacked security claims:** "Encrypted (AES-256)" (`building_activation_encrypted`) — no AES-256 encryption of brain state exists in the codebase (verified: AES-256 appears only in `integration-svc/credentials.ts`, `ai_svc/speech_buddy/encryption.py`, `packages/security/mfa-crypto.ts`); brain state is plain JSONB. "No personal data leaves this device unencrypted" (`clone_privacy_pii`) describes, at best, TLS — and the build runs server-side, so it is simply misleading. ❓ Disk-level encryption at the infra layer was not verifiable from the repo.
- **"Versioned · rollback any time"** (`clone_privacy_versioned`): rollback exists only as a Python API endpoint with **no UI** and **no access scoping** (see point 7).
- **The brain metaphor itself is handled acceptably** — the sphere is abstract, no anatomical imagery, "learning profile" appears in some copy, and `readiness.ts:8-9` even documents that "brain clone is an engineering term, never parent vocabulary." But the parent-facing i18n bundle then says "brain" ~40 times, plus "AIVO Master Brain," "Brain template," "System activation," "Brain v1.0" — engineering vocabulary leaking into the most emotionally loaded screen. No copy anywhere disclaims clinical/diagnostic meaning. Given the platform serves diagnosed neurodiverse children and the profile contains a `disability_signals` field, the absence of a "this is a learning profile, not a clinical assessment" disclaimer is a regulatory exposure, not just a tone issue.

### 5. The approval moment — ❌ The gate does not hold
- **Web-v2 (the live flow):** the Approve button is enabled when the animation finishes (`disabled={!allDone}`, `building-client.tsx:255-258`); the server action checks session + parent-learner scope, flips `cloneStage` to `approved`, audits, and redirects (`brain-clone-watch/page.tsx:36-52` → `repos.ts:715-732`). **No consent checkbox, no RAI acknowledgement, no review of individual inferences, no ceremony — and no celebration after.** The parent is dumped back at the learner detail page.
- **Corrections:** "Add context & rebuild" links to the read-only brain-profile page (`building-client.tsx:244-249`); nothing there edits anything, and nothing ever records `amended: true` (the form field exists at `page.tsx:45` but no UI sets it). The Python API's `parent_modifications` (per-field corrections with original/parent values and notes, folded back into mastery/accommodations/tutors — `brain.py:382-411`) is the right design, **implemented with no client**.
- **Server-side teach-gate (the critical check):**
  - *web-v2:* **Absent.** `completeBaseline` builds mastery map + learning path at baseline completion, pre-approval (`repos.ts:1378-1421`). `pickTodaysMission` checks only path/mastery existence (`today.ts:215-218`). `createLessonRun` requires only that a brain profile **exists** (`repos.ts:1885-1892`) and snapshots the unapproved `brain.state` into the lesson (`repos.ts:1945`). `POST /today/start` adds session/role/scope/rate-limit/consent guards (`app/api/bff/learners/[learnerId]/today/start/route.ts:26-44`) — the consent guard is real, but it checks *onboarding* consent, not brain approval. A learner whose parent never approved can start lessons generated from the unapproved profile. Approval is enforced only by `computeReadinessFor` navigation (`lib/learner/readiness.ts:128-146`) — exactly the "UI badge as gate" anti-pattern this audit was asked to find. (Mitigating: the learner home hides the brain indicator pre-approval — `learner/home/page.tsx:179-186` — which proves the team understands the principle; the enforcement just never reached the lesson pipeline.)
  - *brain-svc (Python):* the gate is **structural but implicit** — learning paths are initialized only inside the approve/amend handlers (`brain.py:478-498`), so unapproved brains have no path. The approve endpoint properly rejects without COPPA consent and RAI acknowledgement (`brain.py:334-346`, tested in `tests/test_approve_rai_gate.py`). However, a repo-wide grep shows `approval_status` is referenced by **no other service** — learning-svc and tutor-svc never re-check it, so the gate depends entirely on path-initialization sequencing rather than an explicit check at teach time.
  - *Mobile:* the Approve button does nothing — both "Approve profile" and "Ask for changes" are `router.push("/(parent)/recommendations")` (`apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx:181-192`), despite the file's own docblock claiming it "closes the gap where mobile-only parents couldn't approve."
- **Decline (Python only):** deletes the brain, all snapshots, **and all of the child's discovery-adventure attempts** (`brain.py:624-631`). A parent declining a profile destroys their child's completed assessment work with no warning, no soft-delete, no export. Web-v2 has no decline at all.

### 6. Evolution — ❌ Mostly missing
- Versioning exists: approve bumps `version` and writes a `parent_approved` snapshot (`brain.py:357, 468-474`); web-v2 regenerate resets approval (`repos.ts:569-574` — correct behavior).
- **No parent notification of brain change exists in either stack** (no comms-svc template, nothing in web-v2 repos/notifications referencing brain changes). The regression detector (`brain.py:766-869`) writes `causal_analyses` rows and optionally emits recommendation candidates — nothing surfaces to the parent.
- **No re-approval threshold:** post-approval, `episodic_memory` and engagement data mutate the brain freely (`brain.py:872-919`); there is no "this profile has drifted N% since you approved it" trigger.
- **Audit trail:** partial. `BRAIN_CLONED` emits an audit event (`brain.py:178-188`) but **approve does not** emit one in brain-svc; consent/RAI records are buried inside the `xai_explanation` JSONB (`brain.py:413-432`) rather than a dedicated consent table. Web-v2 does audit `brain_profile.approve` (`brain-clone-watch/page.tsx:47-50`). Snapshots give who/when implicitly via trigger labels, not actor identity.

### 7. Access control — Mixed: pages good, service layer leaky
- **Good:** every web-v2 parent page checks `parentCanAccessLearner` (`brain-clone-watch/page.tsx:82-84`, `brain-profile/page.tsx:83-85`); the learner Awakening enforces session-learner identity (`learner/brain-clone/[learnerId]/page.tsx:31-33`); brain-svc's sensitive endpoints `/review`, `/pre-clone-data`, `/approve`, `/amend`, `/decline` all call `_verify_parent_access` (`brain.py:204-217`).
- **Leaky:** in brain-svc, `GET /{learner_id}` (full brain state incl. `disability_signals`, `iep_profile`), `GET /{learner_id}/history`, `POST /{learner_id}/rollback`, `GET /{learner_id}/context`, and `POST /{learner_id}/regression-check` require **only a valid JWT — no learner-scope check at all** (`brain.py:192-202, 637-703, 705-763, 766+`). The same is true of both snapshot routes (`routes/snapshots.py:9-25`); `GET /detail/{snapshot_id}` doesn't even filter by learner. `verify_learner_access` (which implements teacher/caregiver/therapist scoping) exists in `services/access_control.py` and is simply not applied. Any authenticated user of any role can read any child's full brain state and **roll it back**. The auth docstring assumes the BFF is the only caller (`auth.py:18-21`), but the service accepts user JWTs directly — defense-in-depth is absent on the most sensitive data in the product.
- **Web-v2 BFF over-exposure + bug:** `GET /api/bff/learners/[learnerId]/brain-profile` grants `teacher` and `school_admin` the **entire** profile — including `disabilitySignals`, `iepProfile`, `parentAssessmentSummary`, frustration triggers (`route.ts:18, 33`) — flatly contradicting family-svc's carefully role-scoped views (teacher view excludes disability signals, `collaboration.ts:745-785`). Additionally, line 29 is missing `await` (`const profile = getBrainProfile(...)`), so `profile` is a Promise: the NOT_FOUND branch is unreachable and the endpoint serializes an empty object — i.e., this route is both over-permissioned *and* broken. (Parent web pages don't use it — they call repos directly — so blast radius is external/mobile consumers. ❓ No consumer found in-repo.)

### 8. Emotional craft — The ambition is real; the landing is not
- What's genuinely strong: the three-act structure (clone intro → cinematic build → recap); the persistent WebGL brain sphere reused across parent recap, activation stage, and learner Awakening so the "living brain" is one continuous object; per-learner visual identity (hue/pulse) threaded everywhere; first-run-only intro with replay (`hasSeenClone`, `building-client.tsx:106-118`); thorough `prefers-reduced-motion` handling that still preserves the sphere affordance.
- Where it collapses: the climax is a **recap timeline that reads like a deploy log** ("Selecting brain template", "Mapping assessment scores to mastery", "Initializing learning paths", "System activation", "Brain v1.0") followed by two buttons. Approval — the single most consequential act a parent performs in the product — is an unceremonied form POST that redirects to a dashboard. No "what happens next." No share-worthy artifact. No moment that says *this is your child, seen clearly*. The 23andMe/Wrapped bar is a story about a person; this is a story about a system.

## 4.2 Target experience spec — the reveal-and-approve flow

A screen-by-screen storyboard, concrete enough for the learner-experience track. All data named below already exists in `LearnerBrainProfileState` unless marked **(new)**.

**Screen 0 — The invitation (push/email + parent home card)**
"Maya finished her Discovery Adventure. AIVO has drafted her learning profile — it's waiting for you to review it." CTA: "See what we learned."
*Data:* baseline completion event, learner name. **(new)** comms template + in-app notification on `cloneStage → cloned`.

**Screen 1 — Inputs assembling (keep, re-copy)**
Keep the master→child clone animation and build pacing, but re-voice every label in parent vocabulary: "Starting from how Maya communicates and focuses" (not "Selecting brain template"); "Listening to what you told us" / "Reading the IEP you shared" / "Watching how Maya explored" — one card per *source*, each with its real contribution count ("You answered 11 sections · Her baseline: 23 questions · Ms. Rivera: 2 observations"). Remove "AIVO Master Brain," "Brain v1.0," "AES-256," "System activation." Replace the encryption chip with a true statement: "Private to your family and the team you invite," linking to the data page.
*Data:* `confidenceSignals`, collaborator insight count + roles (`xaiExplanation.accommodationDecisionsDetailed[].source`), assessment section count.

**Screen 2 — Strengths first (new stage, mandatory before any levels)**
"What lights Maya up." 3-5 cards: top interests (parent assessment `strengths` section), strongest subjects (`masteryOverview` filtered to confident/advanced — the same selector the learner Awakening already uses, `learner/brain-clone/[learnerId]/page.tsx:48-51`), and one observed behavior ("She self-corrected 4 times — that's persistence", from `surfaceSignalSummary`).
*Data:* all existing.

**Screen 3 — How Maya learns best (replaces the gap cards)**
Modality, pacing, sensory needs, focus window — framed as operating instructions, not deficits: "Short bursts with movement breaks · Visual-first · Quiet matters." Each card carries a source chip ("You told us" / "Her baseline showed" / "Ms. Rivera observed") and a confidence dot (**new:** 3-level confidence per inference — derivable now from source count + baseline n; no model change required to start).
*Data:* `attentionProfile`, `sensoryProfile`, `preferredModalities`, per-decision `source` fields.

**Screen 4 — Where we'll start (growth framing, honest numbers)**
Per-subject starting points using the existing qualitative estimates ("Reading: building — we'll start gently and move at her pace"). **Delete grade-equivalents and "Gap: Nyr" entirely** unless/until a defensible vertical-scale estimate exists; if a school context requires grade framing, show "working on grade-3 skills" sourced from the curriculum catalogue (curriculum-svc is already the standards source of truth per ADR 0040), with an explicit "starting point, not a label" line.
*Data:* `masteryOverview` (estimates), curriculum alignment.

**Screen 5 — Check our understanding (the correction loop)**
"Did we get this right?" Each inference row: ✓ "That's her" / ✎ "Not quite" → inline correction (toggle accommodations, adjust comfort level, free-text note). Therapist-pinned accommodations show a lock with attribution ("Recommended by her therapist — talk to them before removing"; `removable: false` already exists, `clone_pipeline.py:187-203`). Corrections post as `parent_modifications` — **the Python contract at `schemas.py:80-91` is the spec; build the client for it** (and port the field-level fold to web-v2's `approveBrainClone`).
*Data:* existing decisions arrays; **(new)** correction UI + web-v2 server-action support.

**Screen 6 — The approval ceremony**
One screen, one act. Recap in one sentence ("You're approving the starting profile AIVO will teach from — you can change it anytime, and it never leaves your team"). The RAI disclosure panel (content already written in `DEFAULT_RAI_COMPLIANCE`, `brain-explainability.ts:59-68`) as an expandable; an explicit consent checkbox (reuse `ConsentRow` from `@aivo/ui/auth`); then a deliberate hold-to-approve or signature-style action. On approve: the sphere ignition moment (the Pixi sphere going from 0.55 to full intensity already exists in the activation stage — move it *here*), confetti-free, calm. Server: record consent + RAI version + actor + timestamp in a **dedicated approval/consent table** (not JSONB), emit an audit event, write the snapshot.
*Data:* exists in Python (`brain.py:413-432`); **(new)** in web-v2.

**Screen 7 — What happens next**
"Tomorrow Maya starts with Nova in math — short sessions, movement breaks, read-aloud on. You'll get a note when her profile meaningfully changes, and we'll ask you again before any big shift." Buttons: "See her first week" / "Invite her teacher" (closing the orchestration loop). Optional share artifact: a strengths-only, no-data summary card a parent could keep or share (**(new)**, the Wrapped move — and safe, because it contains only strengths).
*Data:* `pickTodaysMission` output, tutor catalog, team state.

**Approval/versioning mechanics (target):**
- `approval` table: learner_id, brain_version, actor_user_id, action (approved/amended/declined), consent_version, rai_version, modifications JSONB, timestamp.
- Hard server gate: `createLessonRun` (web-v2) and lesson generation (services) refuse unless latest brain version has an approval row — return a typed `brain_not_approved` error the UI maps to "waiting for your grown-up to say go."
- Re-approval policy: mastery-level changes flow freely; **structural** changes (functioning level, accommodations added/removed, new tutor activation, IEP-derived changes) set `pending_parent_review` on the *delta* (not blocking existing teaching), notify the parent, and require ack within N days.
- Decline = archive, never delete: keep the baseline attempts; offer "rebuild with corrections" instead of forcing the child to redo the assessment.

---

# 5. Top 10 improvements (ranked by trust + completion impact vs. effort)

1. **Enforce approval server-side in web-v2** — add `cloneStage === "approved"` (or approval-row) checks to `createLessonRun` (`repos.ts:1885`) and `pickTodaysMission`; return a typed blocker. *Effort: small. This converts the product's central promise from convention to guarantee.*
2. **Scope the brain-svc read/rollback endpoints** — apply the already-written `verify_learner_access` (`services/access_control.py:8-40`) to `GET /{learner_id}`, `/history`, `/context`, `/rollback`, `/regression-check`, and both snapshot routes; restrict `/rollback` to parent/admin. *Effort: hours. Closes an any-authenticated-user read/write hole on the most sensitive child data.*
3. **Remove or truthify the trust-moment claims** — delete "AES-256" and "no personal data leaves this device" chips, or implement the encryption they claim; delete `scoreToGradeEquiv` grade-gap cards. *Effort: small (copy/UI); the honest version is also the better-designed version (§4.2 screen 4).*
4. **Fix the correction loop** — build the per-inference review screen (§4.2 screen 5) against the existing `parent_modifications` contract; make "Add context & rebuild" land somewhere editable; stop regenerate from silently resetting to `pre_clone` without explanation. *Effort: medium. Directly converts "amend" abandonment into approvals.*
5. **Make the mobile approve button approve** — wire it to the approval endpoint with the same consent/RAI capture; until then, hide it. *Effort: small. A non-functional approve button on the 11pm-parent device is the single worst trust artifact found.*
6. **Build the teacher flow** — a 5-screen, autosaving, token-entry assessment using the existing backend (`teacher-assessment.ts`) and the existing form primitives from the parent wizard (`packages/ui/src/assessment/*`). *Effort: medium. Unlocks the entire multi-source value proposition.*
7. **Add the strengths stage + parent-language copy to the build sequence** — reorder stages (strengths before levels), re-voice the seven stage titles, replace tutor slugs with names. *Effort: small-medium; pure copy/ordering with existing data.*
8. **Completion-tracking hub + automatic reminders** — a "Maya's team" card showing invited → accepted → contributed per person, humanized statuses, one-tap re-send; a comms-svc job nudging at 48h and pre-expiry. *Effort: medium.*
9. **Approval ceremony + consent capture in web-v2** — RAI panel (content exists in `brain-explainability.ts`), consent checkbox, deliberate approve action, dedicated consent/approval record, post-approve "what happens next." *Effort: medium. Also reconciles web-v2 with the Python contract.*
10. **Honor accessibility preferences inside the baseline** — apply font/spacing/text-size from `accessibilityDefaults` to the question card; add a switch-scanning input mode. *Effort: medium-large, but this is the product's stated reason to exist.*

---

# 6. Roadmap

## Quick wins (days)
| Item | Definition of done |
|---|---|
| Server-side approval gate in web-v2 (#1) | A learner with `cloneStage !== "approved"` receives a typed `brain_not_approved` blocker from `/today/start`; regression test mirrors `readiness.brain-build.test.ts` cases. |
| Scope brain-svc endpoints (#2) | Every brain/snapshot route calls `verify_learner_access`; a non-related TEACHER JWT gets 403 on `GET /api/brain/{id}`; rollback is parent/admin-only; tests added. |
| Truthful trust chips + remove grade-gap (#3) | No parent-facing string claims encryption that isn't implemented; `building_gap` and `scoreToGradeEquiv` removed; domains stage shows qualitative estimates only. |
| Hide/wire mobile approve (#5) | Mobile approve either POSTs an approval that flips state (verified by re-fetch) or is not rendered. |
| Stage copy re-voice + strengths reorder (#7) | Build sequence opens with a strengths stage; no stage title contains "template," "system," or a version string; tutor names render instead of slugs. |
| Fix BFF brain-profile route | `await` added; role list reduced to parent (or a role-scoped projection per family-svc's pattern); contract test asserts a teacher cannot read `disabilitySignals`. |
| Raw enum cleanup | No `PENDING`/`ACCEPTED` enum strings rendered to parents (team-invite-section). |

## Structural (weeks)
| Item | Definition of done |
|---|---|
| Correction loop (#4) + approval ceremony (#9) | Parent can mark any inference "not quite," adjust it, and approve; corrections persist (web-v2 parity with `parent_modifications`); approval records consent version, RAI version, actor, timestamp in a dedicated table; approve emits an audit event in both stacks; decline archives instead of deleting baseline attempts. |
| Teacher flow (#6) | Invite email → token-authenticated entry → ≤10-min autosaving assessment → submission visible in parent hub and folded into the clone; completion telemetry shows median time-to-complete. |
| Orchestration hub + reminders (#8) | Parent sees per-contributor invited/accepted/contributed status; automatic 48h + pre-expiry reminder emails ship from comms-svc; brain review screen displays which sources contributed ("built from 3 of 4 invited voices"). |
| Baseline accessibility (#10, part 1) | `accessibility-contract` imported by baseline components; font/spacing/size defaults visibly applied to the question card; mobile `BREAK_EVERY`/subjects unified with web. |
| Therapist polish | Autosaving draft, time estimate, IEP goals shown beside the form, post-submit summary record. |

## Strategic (a quarter)
| Item | Definition of done |
|---|---|
| One brain, one gate | A single approval/consent data model shared by web-v2 and brain-svc (or one stack retired per ADR); the teach-time gate is asserted by an integration test that runs against both lesson pipelines; FERPA disclosure log records every cross-role read of a child profile. |
| Brain evolution + re-approval | Structural profile changes notify the parent and require acknowledgement; parents see a change timeline ("what changed since you approved"); regression detections surface as parent-readable insights, not just `causal_analyses` rows. |
| The full reveal (§4.2) | Storyboard screens 0-7 shipped; reveal completion→approval conversion and time-to-approve instrumented; a strengths-only share artifact exists; copy reviewed against a "would a parent of a newly-diagnosed child feel seen?" rubric. |
| Switch/AAC baseline | Baseline completable via switch scanning and the existing aac-bridge; verified with the vendor-certification suite. |
| Contributor feedback loop | Teachers/therapists receive "your input shaped X" notifications; contributor retention measured. |

---

## Appendix: items marked ❓ Unverified

- Infra-level encryption-at-rest for the database (would not, regardless, justify the "AES-256" UI chip as written).
- Whether any non-web-v2 surface (web-admin, mobile) provides teacher insight submission — none found in-repo.
- Mobile rendering quality of the parent assessment (no native wizard found; assumed responsive web).
- Automated accessibility (axe/Lighthouse) coverage of the assessment routes — config files exist for marketing and web-v2 (`lighthouserc.*.json`) but per-route a11y assertions for these flows were not located.
- Virus scanning of IEP uploads (no code-level scan; possible at infra/gateway).
- Runtime behavior of all flows: this audit is code-evidence only; the app was not executed in this environment.
