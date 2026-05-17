\# 📋 Product Requirements Document (PRD) v2.0 — Enterprise Edition

\#\# AIVO Learning SaaS Platform

\*\*Version:\*\* 2.0 (Enterprise Readiness Update)  
\*\*Date:\*\* April 11, 2026  
\*\*Author:\*\* artpromedia  
\*\*Repository:\*\* \[artpromedia/aivo-learning-saas\](https://github.com/artpromedia/aivo-learning-saas)  
\*\*Classification:\*\* Internal — Confidential

\---

\#\# Table of Contents

1\. \[Executive Summary\](\#1-executive-summary)  
2\. \[Problem Statement\](\#2-problem-statement)  
3\. \[Target Users & Roles\](\#3-target-users--roles)  
4\. \[Core Feature Modules\](\#4-core-feature-modules)  
5\. \[Technical Architecture\](\#5-technical-architecture)  
6\. \[AI/ML Strategy\](\#6-aiml-strategy)  
7\. \[Compliance & Security\](\#7-compliance--security)  
8\. \[Internationalization\](\#8-internationalization-i18n)  
9\. \[Design System\](\#9-design-system)  
10\. \[Mobile App\](\#10-mobile-app)  
11\. \[Billing & Monetization\](\#11-billing--monetization)  
12\. \[Testing Strategy\](\#12-testing-strategy) \*(Enterprise Updated)\*  
13\. \[Deployment & DevOps\](\#13-deployment--devops) \*(Enterprise Updated)\*  
14\. \[Enterprise Readiness Gap Analysis\](\#14-enterprise-readiness-gap-analysis) ⭐ NEW  
15\. \[Enterprise Remediation Roadmap\](\#15-enterprise-remediation-roadmap) ⭐ NEW  
16\. \[Communication & Notifications\](\#16-communication--notifications)  
17\. \[Third-Party Integrations\](\#17-third-party-integrations)  
18\. \[Success Metrics\](\#18-success-metrics-kpis)  
19\. \[Open Items & Roadmap\](\#19-open-items--roadmap)

\---

\#\# 1\. Executive Summary

\*\*AIVO Learning\*\* is an \*\*AI-powered adaptive learning platform designed for children on the autism spectrum\*\*. The platform uses cognitive profiling ("Brain"), AI-driven tutors, adaptive learning paths, and gamification to deliver personalized educational experiences. It serves families (B2C) and schools/districts (B2B) with role-based dashboards for \*\*Parents, Learners, Teachers, Caregivers, and Administrators\*\*.

\#\#\# Enterprise Readiness Status

Following a comprehensive 14-area audit, the platform has a \*\*solid technical foundation\*\* but requires targeted investments to reach enterprise-grade production readiness. Three areas are \*\*critical blockers\*\*: API documentation, disaster recovery, and code coverage tracking. This PRD v2.0 incorporates all audit findings with prioritized remediation plans.

| Overall Maturity | Score |  
|---|---|  
| \*\*Current State\*\* | 🟡 \*\*Growth-Stage SaaS\*\* (\~65% Enterprise Ready) |  
| \*\*Target State\*\* | 🟢 \*\*Enterprise-Grade Platform\*\* (95%+ Enterprise Ready) |  
| \*\*Estimated Gap Closure\*\* | 8–12 weeks of focused engineering |

\---

\#\# 2\. Problem Statement

Children on the autism spectrum have widely varying cognitive profiles and learning needs. Existing educational platforms offer one-size-fits-all curricula, lack IEP (Individualized Education Program) integration, and fail to accommodate neurodivergent learning styles. Parents, teachers, and caregivers need a unified platform that:

\- Adapts to each child's unique cognitive profile in real time  
\- Aligns with district-specific curriculum standards (Common Core, TEKS, NYSLS, BEST, etc.)  
\- Provides IEP goal tracking and accommodations management  
\- Enables collaborative care across families, schools, and caregivers  
\- Maintains strict COPPA, FERPA, and GDPR compliance for child data privacy  
\- \*\*\[Enterprise\]\*\* Meets SOC 2 Type II, penetration testing, and audit-trail requirements demanded by school districts and enterprise buyers

\---

\#\# 3\. Target Users & Roles

| Role | Description | Key Activities |  
|------|-------------|----------------|  
| \*\*Parent\*\* | Primary account holder, data controller | Manage children, view brain profiles, approve recommendations, track progress, manage billing, export/delete data |  
| \*\*Learner\*\* | Child user (autism spectrum) | Engage with learning paths, AI tutors, quests, challenges, earn badges/XP |  
| \*\*Teacher\*\* | School-based educator | View classrooms, monitor at-risk students, review brain profiles (read-only), track IEP goals |  
| \*\*Caregiver\*\* | Therapist, aide, or family member | Read-only access to brain profile, accommodations, IEP goals, gradebook, session history |  
| \*\*Platform Admin\*\* | AIVO internal staff | Manage tenants, monitor platform health, review analytics |  
| \*\*District Admin\*\* | School district administrator | Manage schools, teachers, curriculum standards, district-wide reporting |

\---

\#\# 4\. Core Feature Modules

\#\#\# Module 0: Authentication & Onboarding  
\- JWT-based auth (RS256) via \`identity-svc\` with cookie \+ Bearer token support  
\- Google OAuth and Apple OAuth SSO  
\- Parent-initiated account creation (COPPA-compliant consent flow)  
\- Learner accounts use PIN-based login (e.g., \`1234\`)  
\- Role-based route middleware with auto-redirect  
\- Onboarding wizard with optional state/zip for district auto-detection

\#\#\# Module 1A: Assessment & IEP  
\- \*\*Assessment Engine\*\* (\`assessment-svc\`): Parent questionnaires and baseline assessments with AI-generated items  
\- \*\*IEP Document Parsing\*\*: Upload IEP PDFs → AI extracts goals via vision model (\`IEP\_PARSE\_MODEL\`)  
\- \*\*IEP Goal Tracking\*\*: Structured goals with progress monitoring per learner  
\- \*\*Accommodation Management\*\*: Per-learner accommodations derived from brain profile and IEP

\#\#\# Module 1B: Brain (Cognitive Profiling)  
\- \*\*Brain Service\*\* (\`brain-svc\`, Python/FastAPI): Builds and maintains cognitive profiles per learner  
\- \*\*Brain State\*\*: Visual-spatial learning preferences, sensory profiles, processing strengths/challenges  
\- \*\*Curriculum Resolution\*\*: Maps learner's grade level \+ district framework → personalized skill maps  
\- \*\*Parent-only approval gates\*\*: Recommendations to modify brain profile require parent consent  
\- \*\*Teacher read-only access\*\*: FERPA-compliant separation of concerns

\#\#\# Module 2A: AI Content Generation  
\- \*\*AI Service\*\* (\`ai-svc\`, Python/FastAPI): Central AI orchestration layer  
\- \*\*Multi-model routing\*\*: Reasoning (Claude Sonnet), Smart, Fast, Vision, and self-hosted model tiers with automatic fallback  
\- \*\*RAG pipeline\*\*: Retrieval-augmented generation for contextual content  
\- \*\*Embedding support\*\*: OpenAI \`text-embedding-3-small\` for semantic search  
\- \*\*Langfuse observability\*\*: Configured in \`.env.example\` but \*\*not yet implemented\*\* (see §14)  
\- \*\*Token quota management\*\*: Soft limit alerts at configurable percentage

\#\#\# Module 2B: AI Tutors  
\- \*\*Tutor Service\*\* (\`tutor-svc\`): Subject-specific AI tutors (Math, ELA, Science, History, Coding, SEL, Speech)  
\- \*\*Brain-aware tutoring\*\*: Each session adapts to the learner's cognitive profile  
\- \*\*Streaming responses\*\*: SSE-based real-time tutoring interactions  
\- \*\*Add-on billing\*\*: Individual subject tutors or bundle pricing via Stripe

\#\#\# Module 3A: Learning Paths & Homework  
\- \*\*Learning Service\*\* (\`learning-svc\`): Generates daily adaptive learning paths  
\- \*\*Curriculum-aligned gap activities\*\*: Prioritizes skills matching the learner's district curriculum standards  
\- \*\*Brain context integration\*\*: \`BrainContext\` includes \`curriculumFramework\` and \`curriculumAlignment\`  
\- \*\*Progress tracking\*\*: Session history, gradebook with subject mastery bars

\#\#\# Module 3B: Collaboration & Care Team  
\- \*\*Family Service\*\* (\`family-svc\`): Multi-role family management  
\- \*\*Care team\*\*: Parents can invite/remove caregivers and teachers  
\- \*\*Data export\*\*: GDPR Article 20 compliant ZIP export (JSON \+ Markdown)  
\- \*\*Data deletion\*\*: Full GDPR Article 17 cascading erasure pipeline  
\- \*\*S3 integration\*\*: Family data exports stored in AWS S3

\#\#\# Module 4A: Gamification  
\- \*\*Engagement Service\*\* (\`engagement-svc\`): XP system, badges, quests, challenges  
\- \*\*XP events\*\*: Granular event tracking (activity completion, streaks, etc.)  
\- \*\*Quests & Challenges\*\*: Multi-step learning quests with active/completed states  
\- \*\*Badge system\*\*: Achievement badges with earned/locked states  
\- \*\*Brain-aware rewards\*\*: Engagement tuned to learner's cognitive profile

\#\#\# Module 4B: Avatar Shop  
\- Virtual avatar customization store  
\- Gamification reward integration for purchasing avatar items

\#\#\# Module 5A: Enterprise / B2B  
\- \*\*District Management\*\*: Multi-district support (LAUSD, Houston ISD, NYC DOE, Miami-Dade, etc.)  
\- \*\*School-as-agent-of-parent model\*\*: FERPA-compliant B2B enrollment  
\- \*\*Clever SSO\*\* and \*\*ClassLink SSO\*\* integration (\`integrations-svc\`)  
\- \*\*LTI 1.3\*\* integration for LMS interoperability  
\- \*\*District curriculum standards\*\*: Per-district subject/grade-band standards mapping  
\- \*\*DPA (Data Processing Agreement)\*\* acceptance tracking

\---

\#\# 5\. Technical Architecture

\#\#\# 5.1 Monorepo Structure

| Layer | Technology | Components |  
|-------|-----------|------------|  
| \*\*Build System\*\* | pnpm 10.6.5 \+ Turborepo | Workspace packages, parallel builds, task dependency graph |  
| \*\*Frontend (Web)\*\* | Next.js 15.1.6, React 19, TailwindCSS 4 | \`apps/web\` — main dashboard app |  
| \*\*Frontend (Marketing)\*\* | Next.js 15, Framer Motion | \`apps/marketing\` — public-facing marketing site |  
| \*\*Mobile\*\* | Flutter (Dart), Riverpod, GoRouter, Dio | \`apps/mobile\` — feature-parity mobile app |  
| \*\*Backend (TS)\*\* | Fastify, Drizzle ORM, PostgreSQL | 13 TypeScript microservices |  
| \*\*Backend (Python)\*\* | FastAPI, asyncpg | 2 Python microservices (\`brain-svc\`, \`ai-svc\`) |  
| \*\*Database\*\* | PostgreSQL 16 (pgvector), Drizzle ORM | Shared DB with RLS tenant isolation |  
| \*\*Messaging\*\* | NATS 2.10 with JetStream | Event-driven inter-service communication |  
| \*\*Cache\*\* | Redis 7 | Rate limiting, session caching |  
| \*\*Observability\*\* | Pino \+ OpenTelemetry \+ Prometheus \+ Sentry \+ Grafana | Logging, tracing, metrics, error tracking |

\#\#\# 5.2 Language Composition

| Language | % of Codebase | Usage |  
|----------|---------------|-------|  
| TypeScript | \~72% | All frontend apps \+ 13 backend microservices |  
| Dart | \~25% | Flutter mobile app |  
| Python | \~10% | AI service \+ Brain service |  
| Other | \~3% | Dockerfile, Shell, HCL, CSS, PLpgSQL |

\#\#\# 5.3 Microservices Map (15 services)

| Service | Port | Language | Key Dependencies |  
|---------|------|----------|-----------------|  
| \`identity-svc\` | 3001 | TypeScript | Gateway — proxies to all services |  
| \`brain-svc\` | 3002 | Python | PostgreSQL, Redis, NATS |  
| \`learning-svc\` | 3003 | TypeScript | brain-svc, ai-svc |  
| \`engagement-svc\` | 3004 | TypeScript | brain-svc |  
| \`family-svc\` | 3005 | TypeScript | brain-svc, identity-svc, learning-svc, engagement-svc, tutor-svc, S3 |  
| \`tutor-svc\` | 3006 | TypeScript | brain-svc, ai-svc |  
| \`comms-svc\` | 3007 | TypeScript | Oonrumail, Firebase FCM, Web Push VAPID |  
| \`billing-svc\` | 3008 | TypeScript | Stripe |  
| \`admin-svc\` | 3009 | TypeScript | brain-svc |  
| \`integrations-svc\` | 3010 | TypeScript | Clever, ClassLink, LTI 1.3, S3 |  
| \`i18n-svc\` | 3011 | TypeScript | ai-svc |  
| \`assessment-svc\` | 3012 | TypeScript | ai-svc, S3 |  
| \`research-svc\` | 3013 | TypeScript | — |  
| \`status-page-svc\` | 3014 | TypeScript | Health polling all services |  
| \`ai-svc\` | 5000 | Python | Anthropic, Google, OpenAI, Langfuse |

\#\#\# 5.4 Shared Packages

| Package | Purpose |  
|---------|---------|  
| \`@aivo/brand\` | Design tokens, brand assets, theme constants |  
| \`@aivo/ui\` | Shared React UI component library |  
| \`@aivo/db\` | Drizzle ORM schema \+ migrations (PostgreSQL) |  
| \`@aivo/events\` | Typed NATS event definitions |  
| \`@aivo/feature-flags\` | Feature flag utilities (DB-backed with caching) |  
| \`@aivo/observability\` | Pino logging, OpenTelemetry tracing, Prometheus metrics, Sentry |  
| \`@aivo/security\` | Security headers, CSRF, rate limiting |

\#\#\# 5.5 Infrastructure

| Component | Technology |  
|-----------|-----------|  
| \*\*Container Orchestration\*\* | Docker Compose (dev), Helm charts \+ K3s (prod) |  
| \*\*Infrastructure as Code\*\* | Terraform (HCL) |  
| \*\*Monitoring\*\* | Prometheus \+ Grafana dashboards (5 dashboards: service-overview, database, ai-llm, brain, nats) |  
| \*\*Alerting\*\* | Alertmanager with configured alert rules |  
| \*\*Backup\*\* | Automated backup agent (PostgreSQL pg\_dump \+ Redis RDB → S3 STANDARD\_IA, 30-day retention) |  
| \*\*Production Hosting\*\* | Hetzner Cloud (4 servers in HEL1 — Helsinki) |  
| \*\*CI/CD\*\* | GitHub Actions (11 workflows) |

\---

\#\# 6\. AI/ML Strategy

\#\#\# 6.1 Model Routing Tiers

| Tier | Primary Model | Fallback | Use Case |  
|------|--------------|----------|----------|  
| \*\*Reasoning\*\* | Claude Sonnet 4 | Gemini 2.0 Flash | Complex cognitive analysis |  
| \*\*Smart\*\* | Claude Sonnet 4 | Gemini 2.0 Flash | Content generation, tutoring |  
| \*\*Fast\*\* | Claude Sonnet 4 | Gemini 2.0 Flash | Quick responses, classification |  
| \*\*Vision\*\* | Gemini 2.0 Flash | GPT-4o | IEP document parsing, image analysis |  
| \*\*Self-Hosted\*\* | Ollama/Llama3 | — | On-premise/air-gapped deployments |  
| \*\*Embedding\*\* | text-embedding-3-small | — | Semantic search, RAG |

\#\#\# 6.2 AI Capabilities  
\- \*\*Adaptive content generation\*\*: AI creates learning activities tailored to each learner's brain profile  
\- \*\*IEP document parsing\*\*: Vision AI extracts structured IEP goals from uploaded PDFs  
\- \*\*AI tutoring\*\*: Subject-specific tutors with SSE streaming and brain-aware context  
\- \*\*Curriculum alignment\*\*: AI maps generated content to district-specific standards

\#\#\# 6.3 AI Observability (Gap Identified)

| Component | Status | Action Required |  
|-----------|--------|----------------|  
| Token quota management | ✅ Implemented | Soft limit alerts at configurable % |  
| Prometheus LLM metrics | ✅ Implemented | \`llm\_request\_duration\_seconds\`, \`llm\_tokens\_used\_total\` |  
| Langfuse integration | ❌ \*\*Not implemented\*\* | \`.env.example\` configured, but no code integration — \*\*must implement\*\* |

\---

\#\# 7\. Compliance & Security

\#\#\# 7.1 Regulatory Compliance

| Regulation | Status | Key Controls |  
|------------|--------|-------------|  
| \*\*COPPA\*\* | ✅ Implemented | Parent account required; consent records with versioning; no behavioral advertising; data minimization |  
| \*\*FERPA\*\* | ✅ Implemented | Teacher read-only brain access; parent-only approval gates; audit logging; school-as-agent model |  
| \*\*GDPR\*\* | ✅ Implemented | Right to erasure, data portability, consent management, EU data residency routing |

\#\#\# 7.2 Technical Security Controls — Current State

| Control | Status | Implementation |  
|---------|--------|----------------|  
| PostgreSQL RLS tenant isolation | ✅ | \`0001\_rls\_policies.sql\` with \`app.current\_tenant\_id\` on 20+ tables |  
| Security headers (HSTS, CSP, X-Frame-Options) | ✅ | \`@aivo/security\` headers plugin |  
| CSRF protection | ✅ | Double-submit cookie pattern with \`/csrf-token\` endpoint |  
| API rate limiting | ✅ | Redis-backed tiered limits (auth: 10/min, api: 100/min, admin: 200/min, llm: 30/min) |  
| LLM prompt injection prevention | ✅ | \`prompt\_sanitizer.py\` with pattern detection |  
| Sentry error tracking w/ PII filtering | ✅ | Removes email, username, IP before sending |  
| JWT RS256 tokens | ✅ | Public/private key pair |  
| Input validation (Zod) | ✅ | Zod schemas across all TypeScript services |  
| Vulnerability scanning in CI | ✅ | npm audit \+ pip audit \+ Trivy \+ SARIF upload |  
| Secret scanning | ✅ | Gitleaks on every PR/push \+ weekly scheduled scan |  
| Encryption at rest | ✅ | PostgreSQL \+ S3 AES-256 |  
| Audit logging | ✅ | Append-only \`audit\_events\` table |

\#\#\# 7.3 Security Gaps (Enterprise Blockers)

| Gap | Risk | Remediation |  
|-----|------|-------------|  
| No penetration test reports | 🔴 HIGH | Commission annual pen test from CREST-certified firm |  
| No WAF rule documentation | 🟡 MEDIUM | Document and version-control Cloudflare WAF rules |  
| No secrets rotation strategy | 🟡 MEDIUM | Implement HashiCorp Vault \+ rotation policies |  
| Rate limiter application coverage | 🟡 MEDIUM | Audit that all public endpoints have rate limiting applied |  
| No HTML sanitization (DOMPurify) | 🟡 MEDIUM | Add server-side HTML sanitization for UGC inputs |

\---

\#\# 8\. Internationalization (i18n)

\- \*\*Framework\*\*: \`next-intl\` for all UI text  
\- \*\*Scale\*\*: \~2,050 translation keys across 19 namespaces  
\- \*\*Namespaces\*\*: \`common\`, \`auth\`, \`onboarding\`, \`landing\`, \`dashboard\`, \`assessment\`, \`brain\`, \`tutor\`, \`homework\`, \`gamification\`, \`settings\`, \`errors\`, \`email\`, \`billing\`, \`teacher\`, \`learner\`, \`platformAdmin\`, \`districtAdmin\`, \`caregiver\`  
\- \*\*i18n Service\*\* (\`i18n-svc\`): AI-assisted translation management  
\- \*\*Mobile\*\*: Centralized \`Endpoints\` constants with API-driven localization

\---

\#\# 9\. Design System

\#\#\# 9.1 Philosophy  
Warm, playful, and colorful — designed for neurodiverse learners with sensory-conscious choices.

\#\#\# 9.2 Specifications

| Element | Value |  
|---------|-------|  
| \*\*Primary Color\*\* | \`\#7C3AED\` (AIVO Purple) |  
| \*\*Background\*\* | \`\#FFFBF7\` (warm off-white) |  
| \*\*Typography\*\* | Nunito (display \+ body), extrabold headings |  
| \*\*Card Radius\*\* | \`rounded-3xl\` |  
| \*\*Button Radius\*\* | \`rounded-2xl\` |  
| \*\*Accent Colors\*\* | Coral, Teal, Sunny, Sky, Mint, Pink |  
| \*\*Animations\*\* | Float, wiggle, pop-in, shimmer, slide-up |  
| \*\*Dark Mode\*\* | Warm purple tones (\`\#2A1E45\`, \`\#3D2D5C\`) — no cold grays |

\#\#\# 9.3 Shared Design Primitives  
\`PageWrapper\`, \`BackLink\`, \`ExpandableCard\`, \`StatCard\`, \`AnimatedCard\`, \`EmptyState\`, \`SectionHeader\`, \`InfoModal\`, \`PurpleGradientHeader\`

\#\#\# 9.4 Visual Regression Testing  
\- \*\*Argos CI\*\* (\`visual-regression.yml\`): Automated visual regression testing in CI ✅

\---

\#\# 10\. Mobile App

| Aspect | Detail |  
|--------|--------|  
| \*\*Framework\*\* | Flutter (Dart) |  
| \*\*State Management\*\* | Riverpod |  
| \*\*Routing\*\* | GoRouter with role-based shell routes |  
| \*\*HTTP Client\*\* | Dio with auth interceptor |  
| \*\*Token Storage\*\* | SecureStorage (JWT) |  
| \*\*Screens\*\* | 21 role-specific screens \+ shared |  
| \*\*API Pattern\*\* | FutureProviders → centralized Endpoints → ApiClient, with mock data fallback |  
| \*\*Feature Parity\*\* | Full parity with web dashboard for all 4 roles |

\---

\#\# 11\. Billing & Monetization

\#\#\# 11.1 Subscription Tiers

| Plan | Description |  
|------|-------------|  
| \*\*Starter\*\* | Basic plan |  
| \*\*Family\*\* | Multi-child family plan |  
| \*\*Premium\*\* | Full-featured plan |

\#\#\# 11.2 Add-on AI Tutors (per subject)  
Math, ELA, Science, History, Coding, SEL (Social-Emotional Learning), Speech — available individually or as a \*\*Bundle\*\*

\#\#\# 11.3 Billing Infrastructure  
\- \*\*Provider\*\*: Stripe (subscriptions, webhooks, per-seat pricing)  
\- \*\*Billing Service\*\* (\`billing-svc\`): Handles subscription lifecycle, plan changes, invoicing  
\- \*\*Stripe webhook processing\*\* for real-time subscription events

\---

\#\# 12\. Testing Strategy (Enterprise Updated)

\#\#\# 12.1 Current Test Inventory

| Layer | Tool | Count | Coverage |  
|-------|------|-------|----------|  
| \*\*E2E Tests\*\* | Playwright | 40+ specs | Module-based (auth → assessment → brain → tutors → homework → collaboration → gamification → avatar-shop → enterprise → integration) |  
| \*\*Unit Tests (TS)\*\* | Vitest | 91 test files | 13 services/packages with vitest.config.ts |  
| \*\*Unit Tests (Python)\*\* | Pytest | 37 test files | ai-svc (17), brain-svc (20) |  
| \*\*Package Tests\*\* | Vitest | 11 test files | db, events, observability, brand, ui |  
| \*\*Accessibility\*\* | axe-core/Playwright | 20+ routes | WCAG 2a/2aa on marketing site |  
| \*\*Visual Regression\*\* | Argos CI | Configured | Automated in CI |  
| \*\*Load Tests\*\* | k6 | 2 scenarios | auth-flow, learner-dashboard |  
| \*\*Lighthouse\*\* | Lighthouse CI | Marketing | Performance/a11y/SEO (min 0.9 score) |  
| \*\*Module Gate\*\* | Custom scripts | 4 scripts | stub-audit, route-verifier, dependency-check, module-gate |  
| \*\*Total\*\* | — | \*\*\~16,681 lines of test code\*\* | — |

\#\#\# 12.2 Testing Gaps (Enterprise Blockers)

| Gap | Current | Enterprise Target | Priority |  
|-----|---------|-------------------|----------|  
| \*\*Code coverage tracking\*\* | ❌ None | c8/istanbul with 80% threshold in CI | 🔴 CRITICAL |  
| \*\*Coverage gates in CI\*\* | ❌ None | Block merge below threshold | 🔴 CRITICAL |  
| \*\*Mutation testing\*\* | ❌ None | Stryker.js for critical paths | 🟡 MEDIUM |  
| \*\*Integration tests\*\* | ⚠️ Limited | Service-to-service contract tests | 🟠 HIGH |  
| \*\*Performance baselines\*\* | ❌ None | k6 threshold enforcement (p95 \< 200ms) | 🟡 MEDIUM |  
| \*\*App (web) a11y tests\*\* | ❌ None | axe-core on all dashboard routes | 🟠 HIGH |  
| \*\*Keyboard navigation tests\*\* | ❌ None | Playwright keyboard-only test suite | 🟡 MEDIUM |  
| \*\*Screen reader tests\*\* | ❌ None | NVDA/JAWS automated testing | 🟡 MEDIUM |

\---

\#\# 13\. Deployment & DevOps (Enterprise Updated)

\#\#\# 13.1 CI/CD Pipeline Inventory

| Workflow | File | Trigger | Purpose |  
|----------|------|---------|---------|  
| \*\*CI\*\* | \`ci.yml\` | PR, push to main | Build, lint, typecheck, unit tests, E2E tests, secret scan |  
| \*\*Deploy Staging\*\* | \`deploy-staging.yml\` | Push to main | Multi-stage: resolve → build matrix → Helm deploy → rollout verification |  
| \*\*Deploy Production\*\* | \`deploy-production.yml\` | Manual trigger | Canary deployment with manual approval gate, atomic Helm upgrades |  
| \*\*Secret Scan\*\* | \`secret-scan.yml\` | PR, push, weekly (Mon 03:00 UTC) | Gitleaks scanning → SARIF upload |  
| \*\*Security Scan\*\* | \`security-scan.yml\` | PR, push, daily | npm audit \+ pip audit \+ Trivy → SARIF upload |  
| \*\*Load Test\*\* | \`load-test.yml\` | Manual/scheduled | k6 auth-flow \+ learner-dashboard scenarios |  
| \*\*Marketing Lighthouse\*\* | \`marketing-lighthouse.yml\` | PR/push | Performance, a11y, SEO audits (min 0.9) |  
| \*\*Create Release\*\* | \`create-release.yml\` | Manual | Semantic versioning, image tagging |  
| \*\*E2E Module Gate\*\* | \`e2e-module-gate.yml\` | PR | Module-based E2E test gating |  
| \*\*Visual Regression\*\* | \`visual-regression.yml\` | PR | Argos visual diff testing |  
| \*\*Infra Plan/Deploy\*\* | \`infra-plan.yml\` / \`infra-deploy.yml\` | PR/manual | Terraform plan and apply |

\#\#\# 13.2 Current Deployment Architecture

| Stage | Tooling | Status |  
|-------|---------|--------|  
| \*\*Local Dev\*\* | \`docker-compose.dev.yml\` (15 services \+ Postgres, Redis, NATS) | ✅ |  
| \*\*Build\*\* | Turborepo (\`turbo build\`) with dependency graph | ✅ |  
| \*\*Container Registry\*\* | Docker images per service | ✅ |  
| \*\*Infrastructure\*\* | Terraform (IaC) \+ Helm charts (K3s) | ✅ |  
| \*\*Production\*\* | Hetzner Cloud — 4 dedicated servers in HEL1 (Helsinki) | ✅ |  
| \*\*Canary Deployment\*\* | 5-minute soak → full rollout | ✅ |  
| \*\*Atomic Rollback\*\* | \`helm upgrade \--atomic \--wait\` | ✅ |  
| \*\*Manual Production Gate\*\* | \`production-approval\` environment | ✅ |

\#\#\# 13.3 Deployment Gaps (Enterprise Blockers)

| Gap | Current | Enterprise Target | Priority |  
|-----|---------|-------------------|----------|  
| \*\*Blue-green deployment\*\* | ❌ Canary only | Flagger or Istio progressive delivery | 🟡 MEDIUM |  
| \*\*Manual rollback workflow\*\* | ❌ Relies on \`--atomic\` | Explicit rollback GH Action with one-click trigger | 🟠 HIGH |  
| \*\*Smoke tests post-deploy\*\* | ⚠️ Basic health checks | Comprehensive smoke suite hitting critical paths | 🟠 HIGH |  
| \*\*Database migration verification\*\* | ❌ None | Pre-deploy schema validation step in CI | 🟠 HIGH |  
| \*\*Staged traffic shifting\*\* | ❌ None | Gradual % rollout (10% → 50% → 100%) | 🟡 MEDIUM |  
| \*\*k6 threshold enforcement\*\* | ⚠️ Results uploaded, not analyzed | Fail pipeline on p95 \> threshold | 🟡 MEDIUM |

\---

\#\# 14\. Enterprise Readiness Gap Analysis ⭐ NEW

This section captures the full findings of the 14-area enterprise audit conducted against the repository.

\#\#\# 14.1 Enterprise Maturity Scorecard

| Area | Status | Risk | Score |  
|------|--------|------|-------|  
| Testing | ⚠️ 102+ test files, no coverage tracking | 🔴 HIGH | 5/10 |  
| CI/CD | ✅ 11 workflows, canary \+ atomic rollback | 🟡 MED-HIGH | 7/10 |  
| Observability | ✅ Pino \+ OTel \+ Prometheus \+ Sentry \+ Grafana | 🟡 MEDIUM | 7/10 |  
| Security | ✅ Headers, CSRF, RLS, rate limits, Zod, scanning | 🟡 MEDIUM | 7/10 |  
| Database | ✅ Drizzle migrations, RLS, indexes, S3 backups | 🟡 MEDIUM | 6/10 |  
| API Documentation | ❌ \*\*Zero\*\* OpenAPI/Swagger/Postman | 🔴 \*\*CRITICAL\*\* | 1/10 |  
| Resilience | ⚠️ Health checks \+ Sentry, no circuit breakers | 🟡 MEDIUM | 4/10 |  
| Configuration | ✅ Feature flags (DB-backed), env separation | 🟡 MEDIUM | 6/10 |  
| Performance | ⚠️ k6 \+ Lighthouse \+ Redis caching, no thresholds | 🟡 MED-LOW | 5/10 |  
| Documentation | ⚠️ Compliance \+ deployment docs, no ADRs/runbooks | 🟡 MEDIUM | 4/10 |  
| Accessibility | ⚠️ Marketing a11y only, app untested | 🟡 MEDIUM | 4/10 |  
| Disaster Recovery | ⚠️ Backups exist, single region, no DR plan | 🔴 HIGH | 3/10 |  
| Dependencies | ✅ npm/pip audit \+ Trivy, no Renovate/SBOM | 🟡 MEDIUM | 5/10 |  
| Multi-Tenancy | ✅ RLS solid, no per-tenant limits | 🟡 MEDIUM | 6/10 |  
| \*\*OVERALL\*\* | | | \*\*54/140 (38.6%)\*\* |

\#\#\# 14.2 Critical Gaps (🔴 Resolve Immediately — Weeks 1–3)

\#\#\#\# 14.2.1 API Documentation — CRITICAL (Score: 1/10)

\*\*Current State:\*\* Zero OpenAPI/Swagger specs, zero Postman collections, zero API contract tests.

\*\*Impact:\*\* Breaking API changes can be deployed without detection. New developers have no reference. Enterprise buyers require API documentation for procurement.

\*\*Remediation Plan:\*\*

| Action | Tool | Scope | Owner |  
|--------|------|-------|-------|  
| Add \`@fastify/swagger\` \+ \`@fastify/swagger-ui\` to all 13 TS services | Fastify Swagger | All TS microservices | Backend Team |  
| Add FastAPI automatic \`/docs\` endpoint for \`brain-svc\` and \`ai-svc\` | FastAPI built-in | 2 Python services | AI/ML Team |  
| Generate OpenAPI 3.1 specs in CI and publish to \`/api-docs\` | CI workflow | Monorepo | DevOps |  
| Implement API contract testing with \`@pact-foundation/pact\` | Pact | Cross-service | QA Team |  
| Export Postman collections from OpenAPI specs | Postman | All services | DevRel |  
| Add API versioning strategy (URL path: \`/v1/\`, \`/v2/\`) | Convention | All services | Architecture |  
| Add backward compatibility checks in CI | \`openapi-diff\` | CI pipeline | DevOps |

\#\#\#\# 14.2.2 Disaster Recovery — HIGH (Score: 3/10)

\*\*Current State:\*\* All 4 Hetzner servers in HEL1 (Helsinki) — single region. Backups created (pg\_dump → S3, 30-day retention) but never tested. No documented RTO/RPO. No recovery playbook.

\*\*Impact:\*\* A regional outage at Hetzner HEL1 results in complete platform downtime with unknown recovery time.

\*\*Remediation Plan:\*\*

| Action | Target | Priority |  
|--------|--------|----------|  
| Define RTO and RPO SLAs (target: RTO \< 4h, RPO \< 1h) | Documentation | Week 1 |  
| Write step-by-step DR playbook (runbook) | \`docs/disaster-recovery-playbook.md\` | Week 1 |  
| Implement automated backup restore testing (weekly cron → test DB → validate) | \`infra/backup-agent/\` | Week 2 |  
| Provision secondary Hetzner region (FSN1 — Falkenstein) or AWS eu-west-1 | Terraform | Week 3 |  
| Configure PostgreSQL streaming replication to secondary region | Infrastructure | Week 4 |  
| Document and test failover procedure | Runbook | Week 4 |

\#\#\#\# 14.2.3 Code Coverage — HIGH (Score: 5/10 for Testing)

\*\*Current State:\*\* 102+ test files exist (\~16,681 lines of test code) but no coverage tracking tool configured. No NYC, c8, istanbul, or SonarQube. No coverage thresholds enforced.

\*\*Remediation Plan:\*\*

| Action | Tool | Target |  
|--------|------|--------|  
| Add \`c8\` coverage provider to all Vitest configs | c8 \+ Vitest | 80% line coverage |  
| Add \`pytest-cov\` to Python services | pytest-cov | 80% line coverage |  
| Add coverage threshold gates in \`ci.yml\` (fail on \< 80%) | CI | All services |  
| Upload coverage reports to Codecov or SonarQube | Codecov/SonarQube | Dashboard visibility |  
| Add coverage badges to README | Shields.io | Developer trust |

\#\#\# 14.3 High Priority Gaps (🟠 Resolve Soon — Weeks 3–6)

\#\#\#\# 14.3.1 Penetration Testing

| Action | Details |  
|--------|---------|  
| Commission annual pen test | CREST-certified firm; cover OWASP Top 10 \+ API security |  
| Implement remediation tracking | GitHub Issues with \`security\` label |  
| Schedule follow-up re-test | Quarterly automated, annual manual |

\#\#\#\# 14.3.2 Resilience & Error Handling (Score: 4/10)

\*\*Current State:\*\* Basic error tracking (Sentry), health check endpoints on all services, webhook retry logic, Helm atomic rollback. Missing: circuit breakers, dead letter queues, service-to-service timeouts, graceful degradation strategy.

\*\*Remediation Plan:\*\*

| Action | Tool | Scope |  
|--------|------|-------|  
| Add circuit breaker to all inter-service HTTP calls | \`opossum\` (Node.js) / \`pybreaker\` (Python) | All 15 services |  
| Configure NATS dead letter queues for failed message processing | NATS JetStream DLQ | Event consumers |  
| Define explicit service-to-service timeout policy (default: 5s, AI calls: 30s) | Fastify/Dio config | All services |  
| Implement graceful shutdown handlers (\`SIGTERM\`, drain connections) | Process handlers | All services |  
| Add retry with exponential backoff for all external API calls | \`p-retry\` / \`tenacity\` | All services |  
| Document fallback behavior for each service dependency | \`docs/resilience-matrix.md\` | Architecture |

\#\#\#\# 14.3.3 Backup Verification

| Action | Details |  
|--------|---------|  
| Automate weekly restore test | Restore latest S3 backup → ephemeral PG instance → validate row counts |  
| Add restore verification to CI | Monthly scheduled workflow |  
| Document manual restore procedure | \`docs/backup-restore-runbook.md\` |

\#\#\#\# 14.3.4 Post-Deploy Smoke Tests

| Action | Details |  
|--------|---------|  
| Create smoke test suite | Hit critical flows: login → create learner → start session → billing check |  
| Integrate into deploy pipelines | Run after canary soak, before full rollout |  
| Alert on smoke failure | Auto-rollback if smoke tests fail |

\#\#\#\# 14.3.5 Database Migration Verification

| Action | Details |  
|--------|---------|  
| Add \`drizzle-kit check\` pre-deploy step | Validate schema drift before Helm upgrade |  
| Shadow database diffing | Compare expected vs. actual schema in staging |  
| Migration rollback scripts | Every \`.sql\` migration gets a \`down\` counterpart |

\#\#\#\# 14.3.6 App Accessibility (Score: 4/10)

\*\*Current State:\*\* Marketing site has axe-core \+ Lighthouse a11y testing on 20+ routes. The main learning app (\`apps/web\`) has \*\*zero automated accessibility testing\*\*.

| Action | Details |  
|--------|---------|  
| Extend Playwright a11y tests to all \`apps/web\` dashboard routes | WCAG 2.1 AA compliance |  
| Add keyboard-only navigation test suite | Tab order, focus management, skip links |  
| Document ARIA attribute strategy | \`docs/accessibility-guidelines.md\` |  
| Add a11y checks to PR review checklist | Template update |

\#\#\# 14.4 Medium Priority Gaps (🟡 Plan for Weeks 6–10)

\#\#\#\# 14.4.1 Secrets Management

| Current | Target |  
|---------|--------|  
| GitHub Actions secrets (native) | HashiCorp Vault with auto-rotation |  
| No env var validation | Zod schema validation at service startup |  
| No secrets rotation policy | 90-day rotation for API keys, 30-day for DB credentials |

\#\#\#\# 14.4.2 Langfuse LLM Observability

| Current | Target |  
|---------|--------|  
| \`.env.example\` has keys configured | Implement \`langfuse\` SDK in \`ai-svc\` Python code |  
| No LLM tracing | Full prompt/completion tracing with cost tracking |  
| No quality scoring | User feedback → Langfuse scores for model evaluation |

\#\#\#\# 14.4.3 Log Aggregation

| Current | Target |  
|---------|--------|  
| Pino structured logging per service | Centralized log aggregation via Grafana Loki or ELK |  
| No cross-service log correlation | \`trace\_id\` correlation across all services (already in pino) |  
| No log retention policy | 30-day hot, 90-day warm, 1-year cold storage |

\#\#\#\# 14.4.4 Automated Dependency Updates

| Current | Target |  
|---------|--------|  
| Vulnerability scanning in CI | Add Renovate Bot for automated dependency PRs |  
| No SBOM generation | CycloneDX SBOM generation in CI for supply chain compliance |  
| No license scanning | \`license-checker\` in CI to block GPL/AGPL dependencies |

\#\#\#\# 14.4.5 Documentation Completeness

| Document | Status | Action |  
|----------|--------|--------|  
| Architecture Decision Records (ADRs) | ❌ Missing | Create \`docs/adr/\` with template, retroactive ADRs for key decisions |  
| Incident Response Runbooks | ❌ Missing | \`docs/runbooks/\` — per-service troubleshooting guides |  
| Developer Onboarding Guide | ❌ Missing | \`docs/onboarding.md\` — local setup, architecture overview, PR workflow |  
| Database ER Diagrams | ❌ Missing | Auto-generate from Drizzle schema via \`drizzle-kit\` |  
| API Changelog | ❌ Missing | Auto-generated from OpenAPI diffs in CI |

\#\#\#\# 14.4.6 Multi-Tenancy Hardening

| Current | Target |  
|---------|--------|  
| RLS policies on 20+ tables ✅ | Add per-tenant resource quotas (storage, API calls, concurrent users) |  
| Feature flag overrides per tenant ✅ | Document tenant onboarding/provisioning flow |  
| No table partitioning | Evaluate partition by \`tenant\_id\` for tables \> 10M rows |  
| No RLS performance analysis | Benchmark RLS overhead at 1K, 10K, 100K tenants |

\#\#\#\# 14.4.7 Performance Optimization

| Area | Action |  
|------|--------|  
| CDN cache headers | Document and version-control Cloudflare cache rules |  
| Database query optimization | Add \`pg\_stat\_statements\` monitoring, document slow query procedures |  
| k6 threshold enforcement | Set p95 \< 200ms thresholds, fail CI on violation |  
| Frontend code splitting | Audit Next.js bundle size, add \`@next/bundle-analyzer\` |  
| Cache invalidation strategy | Document Redis key structure and TTL policies |

\---

\#\# 15\. Enterprise Remediation Roadmap ⭐ NEW

\#\#\# Phase 1: Foundation (Weeks 1–3) — 🔴 Critical Blockers

Week 1 ┊ API Docs: Add @fastify/swagger to identity-svc, brain-svc, learning-svc  
┊ DR: Define RTO/RPO SLAs, write DR playbook  
┊ Coverage: Add c8 to Vitest, pytest-cov to Python, CI gates

Week 2 ┊ API Docs: Swagger on remaining 10 TS services \+ FastAPI /docs  
┊ DR: Automated backup restore testing (weekly)  
┊ Coverage: Codecov integration \+ README badges

Week 3 ┊ API Docs: Contract testing (Pact), Postman collections  
┊ DR: Provision secondary region (Hetzner FSN1)  
┊ Coverage: Enforce 80% threshold gates in ci.yml

\#\#\# Phase 2: Hardening (Weeks 3–6) — 🟠 High Priority

Week 3-4 ┊ Circuit breakers (opossum/pybreaker) across all services  
┊ Commission penetration test  
┊ Post-deploy smoke test suite  
┊ Database migration verification in CI

Week 5-6 ┊ NATS dead letter queues  
┊ Service-to-service timeout policies  
┊ App (web) accessibility test suite  
┊ Backup restore verification workflow  
┊ Manual rollback GitHub Action workflow

\#\#\# Phase 3: Optimization (Weeks 6–10) — 🟡 Medium Priority

Week 6-7 ┊ HashiCorp Vault integration for secrets  
┊ Langfuse SDK implementation in ai-svc  
┊ Grafana Loki log aggregation  
┊ Renovate Bot \+ SBOM generation

Week 8-9 ┊ ADRs (retroactive) \+ incident runbooks  
┊ Developer onboarding guide  
┊ Per-tenant resource quotas  
┊ CDN cache rules \+ bundle analysis

Week 10 ┊ k6 threshold enforcement  
┊ RLS performance benchmarking  
┊ Env var validation (Zod at startup)  
┊ License compliance scanning

\#\#\# Phase 4: Maturity (Weeks 10–12) — Polish

Week 10-11 ┊ SOC 2 Type II preparation  
┊ PostgreSQL streaming replication to secondary region  
┊ Blue-green deployment via Flagger/Istio  
┊ Mutation testing (Stryker.js) for critical paths

Week 12 ┊ Final enterprise audit re-assessment  
┊ Penetration test remediation  
┊ Enterprise documentation package for sales enablement  
┊ Target: 95%+ Enterprise Readiness Score

\#\#\# Investment Summary

| Phase | Duration | Focus | Expected Score Impact |  
|-------|----------|-------|----------------------|  
| Phase 1 | Weeks 1–3 | Critical blockers | 38% → 55% |  
| Phase 2 | Weeks 3–6 | Hardening | 55% → 72% |  
| Phase 3 | Weeks 6–10 | Optimization | 72% → 88% |  
| Phase 4 | Weeks 10–12 | Maturity | 88% → 95%+ |

\---

\#\# 16\. Communication & Notifications

| Channel | Provider | Status |  
|---------|----------|--------|  
| \*\*Email\*\* | Oonrumail API | ✅ |  
| \*\*Push (Mobile)\*\* | Firebase Cloud Messaging (FCM) | ✅ |  
| \*\*Push (Web)\*\* | Web Push VAPID | ✅ |  
| \*\*In-App\*\* | NATS event-driven notifications | ✅ |

\---

\#\# 17\. Third-Party Integrations

| Integration | Purpose | Service | Status |  
|-------------|---------|---------|--------|  
| \*\*Stripe\*\* | Billing & subscriptions | \`billing-svc\` | ✅ |  
| \*\*Anthropic (Claude)\*\* | Primary LLM | \`ai-svc\` | ✅ |  
| \*\*Google (Gemini)\*\* | Fallback LLM \+ Vision | \`ai-svc\` | ✅ |  
| \*\*OpenAI (GPT-4o)\*\* | Vision fallback \+ Embeddings | \`ai-svc\` | ✅ |  
| \*\*Langfuse\*\* | LLM observability | \`ai-svc\` | ⚠️ Configured, not implemented |  
| \*\*Clever\*\* | School SSO | \`integrations-svc\` | ✅ |  
| \*\*ClassLink\*\* | School SSO | \`integrations-svc\` | ✅ |  
| \*\*LTI 1.3\*\* | LMS interoperability | \`integrations-svc\` | ✅ |  
| \*\*Firebase\*\* | Push notifications | \`comms-svc\` | ✅ |  
| \*\*Oonrumail\*\* | Transactional email | \`comms-svc\`, \`identity-svc\` | ✅ |  
| \*\*AWS S3\*\* | File storage & exports | \`family-svc\`, \`integrations-svc\` | ✅ |  
| \*\*Sentry\*\* | Error tracking (PII-filtered) | \`@aivo/observability\` | ✅ |  
| \*\*Prometheus\*\* | Metrics collection | \`@aivo/observability\` | ✅ |  
| \*\*Grafana\*\* | Dashboards (5 dashboards) | \`infra/monitoring\` | ✅ |  
| \*\*Alertmanager\*\* | Alert routing | \`infra/monitoring\` | ✅ |  
| \*\*OpenTelemetry\*\* | Distributed tracing (10% prod sampling) | \`@aivo/observability\` | ✅ |

\---

\#\# 18\. Success Metrics (KPIs)

\#\#\# 18.1 Product Metrics

| Metric | Target | Measurement |  
|--------|--------|-------------|  
| Learning outcome improvement | 20% improvement in IEP goal progress within 6 months | assessment-svc \+ brain-svc |  
| User engagement | 4+ sessions/week per learner | engagement-svc XP events |  
| Parent satisfaction | NPS \> 50 | Survey via comms-svc |  
| School adoption | 50+ districts in Year 1 | admin-svc tenant tracking |  
| AI response quality | \<5% negative feedback on tutor sessions | Langfuse (once implemented) |

\#\#\# 18.2 Enterprise Reliability Metrics ⭐ NEW

| Metric | Target | Measurement |  
|--------|--------|-------------|  
| Platform uptime | 99.9% (8.7h downtime/year max) | status-page-svc \+ Prometheus alerts |  
| API response time (p95) | \< 200ms | Prometheus \`http\_request\_duration\_seconds\` |  
| Deployment frequency | ≥ 2 deploys/week | GitHub Actions deploy history |  
| Change failure rate | \< 5% | Rollback count / deploy count |  
| Mean time to recovery (MTTR) | \< 30 minutes | Incident tracking |  
| RTO | \< 4 hours | DR playbook testing |  
| RPO | \< 1 hour | Backup frequency verification |  
| Code coverage | ≥ 80% all services | Codecov dashboard |  
| Vulnerability remediation | Critical \< 24h, High \< 7d | Trivy \+ npm audit tracking |  
| Compliance audit pass rate | 100% on COPPA/FERPA/GDPR | Automated compliance checks |

\---

\#\# 19\. Open Items & Roadmap

\#\#\# 19.1 Compliance Pending Items

| Item | Priority | Notes |  
|------|----------|-------|  
| Annual FERPA notification template | Medium | Needs template in \`comms-svc\` |  
| Data breach notification process (72h GDPR) | High | Incident response plan needed |  
| Privacy impact assessment documentation | Medium | GDPR requirement |  
| SOC 2 Type II preparation | High | Enterprise buyer requirement |

\#\#\# 19.2 Enterprise Readiness — Top 10 Actions

| \# | Action | Risk | ETA |  
|---|--------|------|-----|  
| 1 | Add OpenAPI/Swagger to all 15 services | 🔴 CRITICAL | Week 1–3 |  
| 2 | Implement code coverage tracking \+ CI gates (80%) | 🔴 CRITICAL | Week 1–3 |  
| 3 | Define RTO/RPO, write DR playbook, test backups | 🔴 CRITICAL | Week 1–3 |  
| 4 | Commission penetration test | 🟠 HIGH | Week 3–4 |  
| 5 | Add circuit breakers \+ timeout policies to all services | 🟠 HIGH | Week 3–5 |  
| 6 | Extend a11y testing to learning app (apps/web) | 🟠 HIGH | Week 5–6 |  
| 7 | Implement Langfuse LLM observability in ai-svc | 🟡 MEDIUM | Week 6–7 |  
| 8 | Add HashiCorp Vault for secrets management | 🟡 MEDIUM | Week 6–7 |  
| 9 | Add Renovate Bot \+ SBOM \+ license scanning | 🟡 MEDIUM | Week 7–8 |

| 10 | Write ADRs, runbooks, and developer onboarding guide | 🟡 MEDIUM | Week 8–10 |

