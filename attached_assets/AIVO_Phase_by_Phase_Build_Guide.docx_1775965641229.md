  
**AIVO LEARNING PLATFORM**

Phase-by-Phase Build Guide

Granular Engineering Implementation Playbook

*36-Week Delivery · 14 Modules · 11-Point Module Gates*

**CONFIDENTIAL · April 2026**

**Table of Contents**

# **Build Guide Overview**

This document provides granular, sprint-level guidance for building the AIVO Learning Platform v3 across 5 phases and 14 modules. Each module includes: specific deliverables, database tables to create, API endpoints to build, NATS events to wire, frontend pages/components, E2E tests to write, and the Module Gate checklist. Enterprise remediation tasks are integrated directly into the phase where they belong — not treated as a separate workstream.

## **Phase Summary**

| Phase | Duration | Modules | Focus |
| :---- | :---- | :---- | :---- |
| **Phase 0** | Weeks 1–4 | 0A, 0B | Foundation \+ Enterprise Critical Blockers |
| **Phase 1** | Weeks 5–10 | 1A, 1B | The Brain (Assessment, Clone, State, IEP, Functioning Levels) |
| **Phase 2** | Weeks 11–18 | 2A, 2B | Learning Engine \+ Core 7 AI Tutors |
| **Phase 3** | Weeks 19–24 | 3A, 3B, 3C | Homework \+ Collaboration \+ Expansion Tutors |
| **Phase 4** | Weeks 25–30 | 4A–4E | Gamification \+ Category-Leader Features |
| **Phase 5** | Weeks 31–36 | 5A, 5B | Enterprise Scale \+ Compliance \+ Offline |

# **Phase 0 — Foundation \+ Enterprise Critical Blockers (Weeks 1–4)**

## **Module 0A: Infrastructure & DevOps \+ Enterprise Blockers**

### **Week 1: Monorepo & Core Infrastructure**

1. Scaffold monorepo with Turborepo \+ pnpm workspaces. Verify all 15 service directories exist.

2. Configure Docker Compose dev environment: PostgreSQL 16 (pgvector), Redis 7, NATS 2.10 with JetStream.

3. Set up shared packages: @aivo/db (Drizzle ORM schema), @aivo/events (Zod-typed NATS events), @aivo/observability (Pino \+ OTel \+ Prometheus \+ Sentry).

4. Configure Playwright E2E framework: playwright.config.ts, auth fixtures, test directory structure organized by module.

5. ENTERPRISE: Define RTO (\<4h) and RPO (\<1h) SLAs. Write docs/disaster-recovery-playbook.md with step-by-step restore procedures.

6. ENTERPRISE: Add @fastify/swagger \+ @fastify/swagger-ui to identity-svc as the first service. Generate OpenAPI 3.1 spec. Verify /api-docs renders.

7. ENTERPRISE: Add c8 coverage provider to Vitest config. Add pytest-cov to Python services. Set 80% threshold.

### **Week 2: CI/CD \+ Observability**

1. Configure GitHub Actions CI workflow: build → lint → typecheck → unit tests (with coverage reporting) → E2E tests → secret scan.

2. Add coverage threshold gates to ci.yml: fail merge if \<80% on any service.

3. Upload coverage reports to Codecov. Add coverage badges to README.

4. Set up Prometheus \+ Grafana with 5 dashboards (service-overview, database, ai-llm, brain, nats).

5. Configure Alertmanager with alert rules for service health, error rate \>1%, latency p95 \>200ms.

6. ENTERPRISE: Add @fastify/swagger to brain-svc, learning-svc, engagement-svc, family-svc (4 more services).

7. ENTERPRISE: Implement automated backup restore testing: weekly cron → restore latest S3 backup → ephemeral PG instance → validate row counts.

8. Set up Terraform (IaC) for Hetzner Cloud provisioning.

### **Week 3: Remaining Infrastructure \+ API Docs**

1. ENTERPRISE: Add @fastify/swagger to remaining 8 TS services (tutor-svc, comms-svc, billing-svc, admin-svc, integrations-svc, i18n-svc, assessment-svc, research-svc, status-page-svc).

2. ENTERPRISE: Enable FastAPI automatic /docs endpoint for ai-svc and brain-svc (Python).

3. ENTERPRISE: Set up @pact-foundation/pact for API contract testing. Create first contract: identity-svc ↔ brain-svc.

4. ENTERPRISE: Provision secondary Hetzner region (FSN1 — Falkenstein) in Terraform. Configure networking.

5. Configure Helm charts for K3s production deployment.

6. Set up deploy-staging.yml and deploy-production.yml workflows with canary \+ atomic rollback.

7. Add openapi-diff backward compatibility check in CI pipeline.

### **Module 0A Gate Criteria**

**All services start and health checks pass. CI pipeline green. Playwright runs smoke suite. All 15 services have Swagger/OpenAPI endpoints. c8/pytest-cov configured with 80% gates. DR playbook written and backup restore tested. Secondary region provisioned.**

## **Module 0B: Auth & Identity (Week 4\)**

1. Build identity-svc with Better Auth: email/password signup, Google OAuth, Apple OAuth.

2. Implement JWT RS256 with public/private key pair. Short-lived access tokens (15 min) \+ secure refresh rotation.

3. Build COPPA-compliant consent flow: parent account required for all child accounts.

4. Implement role-based access: PARENT, LEARNER, TEACHER, CAREGIVER, THERAPIST (new), PLATFORM\_ADMIN, DISTRICT\_ADMIN.

5. Build learner PIN-based login (e.g., 1234).

6. Integrate SendGrid SDK: sendWelcome(), sendVerification(), sendPasswordReset().

7. Build POST /internal/email gateway for cross-service email sending.

8. Implement @aivo/security: security headers (HSTS, CSP, X-Frame-Options), CSRF (double-submit cookie), rate limiting (Redis-backed tiered).

9. Build RLS policies: 0001\_rls\_policies.sql with app.current\_tenant\_id on all tables.

10. Write E2E tests: signup flow, login flow, logout, role enforcement, session persistence, OAuth flows, PIN login, CSRF protection, rate limiting.

11. Generate OpenAPI spec for identity-svc. Export Postman collection.

**Gate: 95% E2E coverage on auth flows. 80% unit coverage. Zero stubs. All routes wired. OpenAPI spec generated. SendGrid integration sending real emails in test env.**

# **Phase 1 — The Brain (Weeks 5–10) ⭐ Most Critical**

## **Module 1A: Assessment Pipeline (Weeks 5–7)**

### **Week 5: Parent Assessment \+ IEP Upload**

1. Build assessment-svc: Fastify scaffold with Swagger, health checks, Prometheus metrics.

2. Create tables: assessment\_attempts, assessment\_responses, parent\_assessments, iep\_workflow\_documents.

3. Build Parent Assessment API: enhanced questionnaire with functioning-level questions (communication mode, device interaction, response method, attention span, diagnoses).

4. Build IEP Upload endpoint: accept PDF/photo, store in S3, publish NATS event assessment.iep.uploaded.

5. Build IEP parsing pipeline in ai-svc: LLM extracts disability categories, accommodations, goals, grade level, communication system, assistive technology, recommended functioning level.

6. Create iep\_profiles table with all parsed fields.

7. Build parent confirmation flow: display extracted IEP data, Confirm/Edit/Skip.

8. Build Functioning Level Routing Engine: combine parent signals \+ IEP data → route to STANDARD/SUPPORTED/LOW\_VERBAL/NON\_VERBAL/PRE\_SYMBOLIC. If conflict, use MORE SUPPORTIVE level.

9. Create learner\_functioning\_levels table.

10. Build sensory profile questionnaire (category-leader feature): capture hyper/hypo/typical for visual, auditory, tactile, vestibular, proprioceptive.

11. Create sensory\_profiles table.

### **Week 6: Baseline Assessment (All Modes)**

1. Build STANDARD assessment mode: adaptive multiple choice, text-based, timer tracked. AI-generated items via ai-svc.

2. Build MODIFIED assessment mode: larger touch targets (48px), 3 choices, audio narration, 1.5x extended time, visual cues.

3. Build PICTURE\_BASED assessment mode: questions as pictures with audio, 2 answer choices (large picture cards), touch-to-select, 5-minute cap, celebration animations.

4. Build SWITCH\_SCAN assessment mode: 2 large options highlight sequentially (2s dwell time), switch activation to select.

5. Build PARTNER\_ASSISTED assessment mode: adult reads choices, observes child’s response (looked at, reached for, vocalized, no clear response), records with confidence level.

6. Build OBSERVATIONAL assessment mode (PRE\_SYMBOLIC): parent completes structured checklist, no child interaction with device. Create observational\_assessments table.

7. Build adaptive item selection engine: domains adapt per functioning level. STANDARD: Reading, Writing, Math, Social-Emotional, Executive Function. LOW\_VERBAL+: Communication, Pre-Academic, Self-Care, Social, Motor/Sensory.

8. Build response time tracking per question (disability signal detection).

### **Week 7: Synthesis Engine \+ E2E Tests**

1. Build Synthesis Engine with weighted scoring: STANDARD: 70% child \+ 30% parent. LOW\_VERBAL: 50% child \+ 30% parent \+ 20% IEP. NON\_VERBAL/PRE\_SYMBOLIC: 40% parent \+ 60% IEP.

2. Calculate per-domain level scores (0.0–1.0). Estimate grade band per domain (PRE\_K through SIXTH\_PLUS).

3. Map IEP goals to curriculum alignment targets.

4. Publish NATS event: assessment.baseline.completed with all data (attemptId, childId, domainScores, functioningLevel, communicationMode, iepProfile, sensoryProfile).

5. Build parent-facing assessment results summary page (adapted per functioning level).

6. Write comprehensive E2E tests: full onboarding flow from parent signup → parent assessment → IEP upload → IEP parse → functioning level determination → all 6 assessment modes → synthesis → NATS event published.

7. Test edge cases: IEP without parent assessment, parent assessment without IEP, conflicting signals, all 5 functioning levels.

**Gate: 95% E2E on full onboarding flow. All 6 assessment modes render and function. IEP parsing returns real LLM output. Functioning level routing deterministic. All API routes return real data. OpenAPI spec generated.**

## **Module 1B: Brain Clone & State Management (Weeks 8–10)**

### **Week 8: brain-svc Scaffold \+ Clone Pipeline**

1. Build brain-svc: Python FastAPI scaffold with /docs, health checks, Prometheus metrics.

2. Create tables: brain\_seed\_templates, brain\_states, brain\_state\_snapshots, brain\_episodes, brain\_insights, brain\_recommendations, functional\_milestones.

3. Build Brain seed template management: templates per grade band, disability profile, and functioning level.

4. Build Brain clone pipeline (NATS subscriber for assessment.baseline.completed): select seed template → deep copy → inject domain scores → inject disability signals → inject functioning level → inject IEP data → inject sensory profile → resolve accommodations → map IEP goals → initialize functional curriculum tracker → save snapshot → INSERT brain\_states → seed Redis episodic namespace.

5. Build Brain state JSONB structure: mastery\_levels, disability\_signals, functioning\_level\_profile, iep\_profile, sensory\_profile, active\_accommodations, curriculum\_alignment, active\_tutors, functional\_curriculum.

6. Build Redis hot cache for Brain context (\< 50ms fetch target).

7. Publish NATS event: brain.cloned → consumed by family-svc, comms-svc, learning-svc.

### **Week 9: Versioning, Rollback & Recommendations**

1. Build Brain versioning: snapshot before every significant mutation. Trigger types: initial\_clone, parent\_approved, mastery\_threshold, rebaseline, main\_brain\_upgrade, tutor\_addon\_activated/deactivated.

2. Build rollback API: restore Brain state from any snapshot. Parent approval required.

3. Build recommendation engine: generate recommendations based on mastery patterns, session analysis, accommodation effectiveness.

4. Implement all recommendation types: brain\_profile\_review, path\_adjustment, accommodation\_add/remove, goal\_suggestion, curriculum\_shift, rebaseline, brain\_upgrade, regression\_alert, tutor\_suggestion, functioning\_level\_change, iep\_goal\_met, iep\_refresh.

5. Build parent approval loop API: APPROVE (apply change), DECLINE (log, re-approach in ≥14 days), ADJUST (accept parent insight as first-class Brain input).

6. Build regression detection: ≥15% mastery drop in any domain within 14 days triggers alert.

7. Build causal analysis engine (category-leader): correlate regression with session frequency, time-of-day, accommodation changes, parent\_reported\_events, school calendar. Present causal hypothesis to parent.

8. Create parent\_reported\_events table for environmental factor tracking.

9. Build Brain context API: GET /brain/{learnerId}/context returns full context for content generation.

### **Week 10: Functional Curriculum \+ Brain E2E**

1. Build functional curriculum tracker for LOW\_VERBAL/NON\_VERBAL/PRE\_SYMBOLIC learners: milestones across Communication, Self-Care, Social-Emotional, Pre-Academic, Motor/Sensory domains.

2. Build milestone progression API: not\_started → emerging → developing → achieved. Evidence notes and observation timestamps.

3. Build parent Brain profile reveal page (adapted per functioning level). IEP goals integration display. Accommodation list. APPROVE/ADD INSIGHTS/DECLINE buttons.

4. Build SendGrid email: brain\_profile\_reveal template.

5. Write comprehensive E2E tests: assessment completion → Brain clone → Brain state persisted and retrievable → IEP data in Brain context → sensory profile in Brain context → functioning level correct → snapshot created → rollback works → recommendation created → parent approval flow → Brain context API returns complete data.

6. ENTERPRISE: Add circuit breakers (pybreaker) to all brain-svc outbound calls.

7. Generate OpenAPI spec for brain-svc.

**Gate: 95% E2E on Brain lifecycle. Clone triggered after assessment. Brain state persisted and retrievable with all fields (including sensory\_profile and IEP data). Version snapshot created. Rollback works. Recommendations generated and resolvable. Brain context API returns complete real data. NATS events published and consumed. OpenAPI spec generated. Circuit breakers active.**

# **Phase 2 — Learning Engine \+ Core 7 AI Tutors (Weeks 11–18)**

## **Module 2A: Content Generation & Delivery (Weeks 11–14)**

### **Weeks 11–12: LLM Gateway \+ Content Quality Gate**

1. Build ai-svc LiteLLM gateway: Anthropic Claude (primary), Google Gemini (secondary), OpenAI GPT (tertiary). Automatic failover.

2. Build 3-layer prompt construction: Layer 1 (Main Brain system prompt from RAG), Layer 2 (Learner Brain context including sensory\_profile), Layer 3 (session request).

3. Build Content Quality Gate: Gate 1 (Safety screening), Gate 2 (Readability vs delivery level), Gate 3 (Accommodation \+ functioning level compliance \+ sensory profile compliance).

4. Build sensory-aware content generation rules: adjust color intensity, animation speed, visual complexity, text density, sound parameters based on sensory\_profile.

5. Build grade gap scaffolding: generate at enrolled grade OBJECTIVES, deliver at actual delivery level LANGUAGE. Half-grade steps automatic, full grade band \= parent approval.

6. Build token quota management: per-tenant daily limits, soft limit (80%) warning, hard limit (HTTP 429).

7. ENTERPRISE: Implement Langfuse SDK in ai-svc for full prompt/completion tracing with cost tracking.

### **Weeks 13–14: Lesson Sessions \+ Brain Updates**

1. Build learning-svc: session lifecycle (start → content generated → delivered → completed).

2. Build Brain context injection into all generated content. Verify sensory profile adjustments applied.

3. Build session completion pipeline: NATS event learner.session.completed → brain-svc updates mastery model → engagement-svc tracks XP.

4. Build learning path generation: Brain-driven, curriculum-aligned gap activities prioritized.

5. Build gradebook with subject mastery bars.

6. Build low-functioning content delivery: LOW\_VERBAL (picture-card mode, 1 sentence/screen, 2 choices, audio-first), NON\_VERBAL (partner-assisted with facilitator guide), PRE\_SYMBOLIC (parent activity guides).

7. Build parent co-learning mode (category-leader): parent joins session, tutor coaches parent in real-time, post-session parent coaching notes generated.

8. Write E2E tests: content generation returns real LLM output → Quality Gate validates/rejects → lesson session completes → mastery updated in Brain → functioning-level content rules enforced → sensory adjustments applied.

9. ENTERPRISE: Add circuit breakers (opossum) to all learning-svc → brain-svc and → ai-svc calls. Define timeout policy: 5s default, 30s for AI calls.

**Gate: Real LLM output (no hardcoded content). Quality Gate validates and rejects non-compliant content. Lesson session completes end-to-end. Functioning-level-specific content rules enforced. Sensory profile adjustments applied. Brain mastery updated. Parent co-learning mode functional. Langfuse tracing active.**

## **Module 2B: Core 7 AI Tutors (Weeks 15–18)**

### **Weeks 15–16: Tutor Infrastructure \+ First 3 Tutors**

1. Build tutor-svc: Fastify scaffold with Swagger, provisioning pipeline, session management.

2. Build tutor subscription → Brain activation pipeline: billing-svc creates subscription\_item → NATS tutor.addon.activated → brain-svc adds to active\_tutors → learning-svc enables tutor session type \+ homework helper.

3. Create tutor\_subscriptions table.

4. Build SubjectTutorAgent in ai-svc: loads Brain context at session start, persona identity \+ subject strategy block \+ Brain context \+ IEP accommodations \+ sensory profile \+ spaced repetition due items injected into system prompt.

5. Build SSE-based real-time streaming for tutor sessions.

6. Implement tutor session flow: spaced repetition review → target skill from mastery gaps → Socratic method → adapt to delivery level → delegate to SupportSpecialistAgent if stuck 3x.

7. Build first 3 tutor personas: Nova (Math — cosmos-themed, visual, step-by-step), Sage (ELA — narrative-driven), Echo (Speech & Language — articulation practice, AAC integration).

8. Build tutor adaptation per functioning level: SUPPORTED (simpler language), LOW\_VERBAL (picture-based, 2-choice, 3–5 min), NON\_VERBAL (partner-assisted), PRE\_SYMBOLIC (parent coaching agent).

9. Build mastery write-back: NATS tutor.session.completed → brain-svc updates per-skill mastery.

### **Weeks 17–18: Remaining 4 Core Tutors \+ Tutor Store**

1. Build remaining 4 core tutor personas: Spark (Science — experiment-first), Chrono (History — time-travel narrative), Pixel (Coding — pair-programming), Harmony (SEL — emotion identification, social stories).

2. Build tutor store UI on parent dashboard: browse all tutors, see subject/persona/price, subscribe, manage active tutors.

3. Build tutor deprovisioning: billing-svc cancellation → 7-day grace period → NATS tutor.addon.deactivated → brain-svc removes from active\_tutors \+ disables homework helper. Mastery data preserved permanently.

4. Build SendGrid emails: tutor\_activated, tutor\_deactivated templates.

5. Build subscription bundle logic: Core 7 bundle, individual add-on, subject packs.

6. Write E2E tests: parent subscribes to tutor → tutor appears in active tutors → tutor session loads real Brain context → generates real LLM responses → mastery written to Brain → deprovisioning removes access after grace → resubscription reconnects → all tutor store buttons functional.

7. ENTERPRISE: Commission penetration test from CREST-certified firm.

**Gate: All 7 core tutors functional with distinct personas. Subscription → provisioning → session → mastery update end-to-end. Tutor store UI fully interactive. Deprovisioning works. All functioning level adaptations render. SSE streaming works.**

# **Phase 3 — Homework \+ Collaboration \+ Expansion Tutors (Weeks 19–24)**

## **Module 3A: Homework Helper (Weeks 19–20)**

1. Build homework upload pipeline: camera capture (mobile), photo gallery, PDF upload, text paste.

2. Build Vision AI processing in ai-svc: OCR with handwriting recognition, LaTeX extraction for math, table/diagram detection. Use Gemini/GPT-4o.

3. Build subject auto-detection from extracted text.

4. Build subscription gate: verify tutor subscription for detected subject before allowing homework help.

5. Build homework adaptation engine: load Brain context, adapt homework text to learner’s effective grade level with scaffolding.

6. Build HomeworkAgent in ai-svc: loaded with subscribed tutor persona, Brain context, Socratic guidance, sub-problem tracking.

7. Build homework session UI: upload → processing animation → adapted view → interactive session with tutor.

8. Build completion quality calculation (0.0–1.0) and NATS event homework.session.completed → brain-svc mastery update \+ spaced repetition schedule update.

9. Build LOW\_VERBAL homework mode: parent-mediated, picture-supported problems. NON\_VERBAL/PRE\_SYMBOLIC: parent guide mode with functional skill equivalents.

10. Create homework\_assignments table.

11. Write E2E tests: photo upload → OCR extracts real text → subject detected → subscription verified → homework adapted → session with real LLM → mastery updated → locked state for unsubscribed subjects.

## **Module 3B: Family Collaboration \+ Category-Leader Features (Weeks 21–22)**

1. Build parent approval loop UI: recommendation inbox, APPROVE/DECLINE/ADJUST actions, insight text box.

2. Build teacher profile access: invite flow (B2C: parent invites, B2B: teacher invites parent), read-only Brain view, insight submission, teacher\_insight recommendation creation.

3. Build caregiver invitation: 2 slots, simplified Brain summary view, observation submission.

4. Build Therapist/BCBA role (category-leader): parent invites therapist, HIPAA-scoped read-only Brain access, therapy goal alignment UI, session notes submission → Brain insight. Create therapy\_sessions and therapy\_goals tables.

5. Build IEP goal tracking on parent dashboard: progress toward each IEP goal, baseline vs. current, trend line.

6. Build IEP Meeting Progress Report generator (category-leader): formatted PDF mapping Brain data to IEP goal language, session logs as evidence, accommodation effectiveness. Auto-generate before iep\_profiles.review\_date.

7. Build IEP refresh reminders: iep\_refresh recommendation at 10 months post-upload.

8. Build conflict resolution: when parent and teacher insights conflict, Brain surfaces conflict resolution recommendation to parent.

9. Build SendGrid emails: iep\_goal\_met, iep\_refresh\_reminder, functioning\_level\_change, weekly\_progress\_digest.

10. ENTERPRISE: Extend Playwright a11y tests (axe-core) to all apps/web dashboard routes. WCAG 2.1 AA compliance. Add keyboard-only navigation test suite.

11. ENTERPRISE: Build post-deploy smoke test suite: login → create learner → start session → billing check. Integrate into deploy pipelines.

## **Module 3C: Expansion Tutors (7 New Tutors, Weeks 23–24)**

1. Build 7 expansion tutor personas: Atlas (Social Studies — explorer-themed), Cadence (Music & Arts — rhythm-based), Vigor (PE/Health — movement coach), Lingua (World Languages — cultural immersion, bilingual scaffolding), Forge (STEM Design — design challenges), Compass (Life Skills — real-world task trainer, transition planning), Muse (Creative Writing — storytelling, portfolio).

2. Each tutor: unique system prompt, subject strategy block, functioning-level adaptations, sensory profile integration.

3. Build Compass tutor’s Transition Planning Module (category-leader): vocational interests assessment, independent living skills tracking, community participation, self-advocacy, post-secondary planning. Create transition\_plans table.

4. Build Lingua tutor’s Multilingual Brain integration (category-leader): language dominance tracking per domain, code-switching in sessions, bilingual content scaffolding. Create language\_profiles table.

5. Update tutor store UI with all 14 tutors, subject packs, Full K–12 bundle.

6. Update pricing page to reflect new bundles.

7. Write E2E tests for all 7 expansion tutors: provisioning, session with real LLM, functioning-level adaptations, mastery write-back.

**Gate: All 14 tutors functional. Homework helper works for all subjects. Therapist role integrated. IEP progress reports generate real PDFs. Transition planning module functional. Multilingual Brain tracks language dominance. a11y tests pass on all dashboard routes. Smoke tests integrated into deploy pipeline.**

# **Phase 4 — Gamification \+ Category-Leader Features (Weeks 25–30)**

## **Module 4A: Core Gamification (Weeks 25–26)**

1. Build engagement-svc: XP award engine wired to all learning events (14 award types). Level system (N² × 100 XP).

2. Build streak engine: daily tracking, teacher-granted freeze (max 2/month), tier visualization (grey→orange→purple→gold).

3. Build badge award engine: 10+ rules, rarity tiers (common/rare/epic/legendary), deduplication.

4. Build virtual currency: coins (activities, quests, challenges) \+ gems (exceptional achievements).

5. Build gamification dashboard: XP card, streak flame, challenges list, leaderboard preview, badge cabinet.

6. Build low-functioning gamification: LOW\_VERBAL (celebration-first, star rewards, no leaderboard, sensory-friendly animations), NON\_VERBAL (cause-and-effect rewards), PRE\_SYMBOLIC (parent-facing gamification only).

7. Wire Brain integration: XP awards update engagement\_profile, badges recorded in episodic memory.

8. Build SendGrid emails: streak\_broken, badge\_earned.

9. Build sibling profile awareness (category-leader): sibling\_links table, family XP leaderboard (opt-in), collaborative activities between siblings.

## **Module 4B: Avatar & Rewards Shop (Week 27\)**

50+ avatar items across 6 categories (hair, outfits, accessories, backgrounds, emotes, skin tones). Rarity-gated pricing, level gating, grade-band filtering, motor-skill exclusion for accessibility. 15 free starters. Purchase flow: coin/gem deduction, inventory update, avatar render.

## **Module 4C: Quests & Adventures (Week 28\)**

5 quest worlds (one per core tutor persona): Nova’s Number Galaxy, Sage’s Story Kingdom, Spark’s Science Lab, Chrono’s Time Tower, Pixel’s Code Forge. Sequential chapters with narrative (intro → activities → boss battle → outro). Boss assessments adapted per functioning level. XP \+ coin rewards.

## **Module 4D: Multiplayer Challenges (Week 29\)**

Quiz battles (1v1), team challenges, weekly tournaments. Invite code system (8-char). Real-time scoring. Domain-specific question banks. Auto-complete when all participants answer.

## **Module 4E: Leaderboard \+ SEL \+ Breaks \+ Teacher Lesson Plans (Week 30\)**

1. Build social leaderboard: class/school/global, teacher-configurable.

2. Build SEL module: emotion check-ins, guided exercises, SEL XP integration.

3. Build break activities: guided breaks triggered by attention signals, 5 XP per break.

4. Build teacher lesson plan generator (category-leader): teacher clicks “Generate Lesson Plan” → Brain-informed, accommodation-compliant lesson plan for classroom, differentiated instruction groups, suggested activities aligned to district curriculum, formative assessment suggestions. Create lesson\_plans table. PDF/docx export.

5. ENTERPRISE: Implement HashiCorp Vault for secrets management. 90-day API key rotation, 30-day DB credentials.

6. ENTERPRISE: Add Renovate Bot for automated dependency PRs. CycloneDX SBOM generation. License scanning.

7. ENTERPRISE: Write retroactive ADRs in docs/adr/. Create incident response runbooks per service.

**Gate: All gamification subsystems functional. XP/streaks/badges/shop/quests/multiplayer wired to real events. Dashboard shows real data. Low-functioning adaptations render. Sibling features work. Teacher lesson plans generate real content. Vault, Renovate, ADRs in place.**

# **Phase 5 — Enterprise Scale \+ Compliance \+ Offline (Weeks 31–36)**

## **Module 5A: B2B Enterprise (Weeks 31–33)**

1. Build district provisioning: multi-district support, SIS sync (Clever/ClassLink/OneRoster).

2. Build school-as-agent-of-parent model (FERPA-compliant enrollment).

3. Build DPA acceptance tracking.

4. Build B2B tutor licensing: districts can bundle all 14 tutors for all learners.

5. Build teacher-initiated IEP upload: teacher uploads IEP before parent completes onboarding, parsed data stored as pending.

6. Build district analytics dashboard: functioning level distribution, milestone progression, tutor usage, IEP goal progress across cohorts.

7. Build custom reporting and exports for district admins.

8. ENTERPRISE: Configure PostgreSQL streaming replication to secondary region (HEL1 → FSN1).

9. ENTERPRISE: Document and test failover procedure. Update DR playbook.

10. ENTERPRISE: SOC 2 Type II preparation: control documentation, evidence collection, policy review.

11. ENTERPRISE: RLS performance benchmarking at 1K/10K/100K tenants. Evaluate table partitioning for tables \>10M rows.

## **Module 5B: Offline \+ Mobile \+ AAC \+ Final Polish (Weeks 34–36)**

1. Build Flutter mobile app with offline Brain sync: Drift SQLite snapshot, sync queue, ContentCacheDb.

2. Build offline lesson caching (up to 10 lessons pre-cached). Mastery updates queued locally.

3. Build mobile gamification: streak card, badge cabinet, shop, quest map.

4. Build AAC device bi-directional integration (category-leader): vocabulary sync protocol with Proloquo2Go, TouchChat, LAMP Words for Life. Create aac\_vocabulary\_sync table.

5. Build all remaining SendGrid templates: status\_incident (wire existing stub in status-page-svc).

6. Build Brain data export: GDPR-compliant ZIP with human-readable summary \+ raw JSON \+ all session history \+ IEP data \+ functional milestones \+ tutor/homework history.

7. ENTERPRISE: Implement blue-green deployment via Flagger or Istio progressive delivery.

8. ENTERPRISE: Add Stryker.js mutation testing for critical paths (Brain clone, assessment synthesis, billing).

9. ENTERPRISE: k6 threshold enforcement: set p95 \<200ms, fail CI on violation.

10. ENTERPRISE: Final enterprise audit re-assessment. Target: 95%+ enterprise readiness score.

11. ENTERPRISE: Compile enterprise documentation package for sales enablement.

12. Run full regression E2E suite across all modules. Verify all 14 tutors, all functioning levels, all gamification systems, all enterprise features.

**Gate: District provisioning end-to-end. SIS import works. District analytics render real data. Mobile app launches and offline mode works. AAC integration syncs vocabulary bi-directionally. Brain data export generates complete ZIP. Streaming replication active. SOC 2 controls documented. Enterprise readiness score ≥95%. All 14 tutors, all functioning levels, all category-leader features operational.**

# **Appendix A — Module Gate Checklist (Copy for Each Module)**

* 1\. 95% E2E Test Coverage — Playwright, real services, real DB, real NATS, real Redis, real LLM (low-cost model).

* 2\. 80% Unit Test Coverage — c8/Vitest (TS), pytest-cov (Python). CI gates enforced.

* 3\. Zero Stubs in Production — No TODO/FIXME, no placeholder responses, no console.log handlers. Grep audit clean.

* 4\. All Routes Wired — Every API route → real service function → real DB query. Every NATS event has a subscriber.

* 5\. All Buttons Click-Through — Every button navigates to real page or triggers real API call with real feedback.

* 6\. Cross-Module Integration — E2E tests for this module call dependent module’s real API. Full event chains verified.

* 7\. Error Handling Complete — Proper HTTP status codes. User-friendly error messages. Network failure handling.

* 8\. Performance Baseline Met — All targets from NFRs verified. No endpoint exceeds 2x target.

* 9\. Email Templates Brand-Compliant — SendGrid. Brand audit passes. CTA links resolve. UTM parameters. Dev fallback works.

* 10\. UI/UX Brand-Compliant — @aivo/brand tokens. axe-core: zero critical/serious. Responsive 375px/768px/1280px. Dark mode.

* 11\. OpenAPI Spec Generated — Swagger UI accessible for all new/modified endpoints. Contract tests passing.

# **Appendix B — Complete Tutor Catalog (14 Tutors)**

| \# | Tutor | Subject | Phase | SKU |
| :---- | :---- | :---- | :---- | :---- |
| 1 | **Nova** | Mathematics | Phase 2 (Core) | ADDON\_TUTOR\_MATH |
| 2 | **Sage** | English Language Arts | Phase 2 (Core) | ADDON\_TUTOR\_ELA |
| 3 | **Spark** | Science | Phase 2 (Core) | ADDON\_TUTOR\_SCIENCE |
| 4 | **Chrono** | History | Phase 2 (Core) | ADDON\_TUTOR\_HISTORY |
| 5 | **Pixel** | Coding & CS | Phase 2 (Core) | ADDON\_TUTOR\_CODING |
| 6 | **Echo** | Speech & Language | Phase 2 (Core) | ADDON\_TUTOR\_SPEECH |
| 7 | **Harmony** | Social-Emotional Learning | Phase 2 (Core) | ADDON\_TUTOR\_SEL |
| 8 | **Atlas** | Social Studies / Civics | Phase 3 (Expansion) | ADDON\_TUTOR\_SOCIAL\_STUDIES |
| 9 | **Cadence** | Music & Arts | Phase 3 (Expansion) | ADDON\_TUTOR\_ARTS |
| 10 | **Vigor** | PE / Health & Wellness | Phase 3 (Expansion) | ADDON\_TUTOR\_PE\_HEALTH |
| 11 | **Lingua** | World Languages | Phase 3 (Expansion) | ADDON\_TUTOR\_LANGUAGES |
| 12 | **Forge** | Engineering / STEM Design | Phase 3 (Expansion) | ADDON\_TUTOR\_STEM\_DESIGN |
| 13 | **Compass** | Life Skills / Transition | Phase 3 (Expansion) | ADDON\_TUTOR\_LIFE\_SKILLS |
| 14 | **Muse** | Creative Writing / Media | Phase 3 (Expansion) | ADDON\_TUTOR\_CREATIVE\_WRITING |

*End of Build Guide*