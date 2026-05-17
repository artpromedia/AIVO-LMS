  
**AIVO LEARNING PLATFORM**

Version 3.0 — Enterprise Edition

Product Requirements Document

*Brain-Clone Architecture · 14 AI Agentic Tutors · No Learner Left Behind*

*Full K–12 Subject Coverage · Category-Leader Features · Enterprise-Grade*

**CONFIDENTIAL · April 2026**

**Table of Contents**

[**Section 1 — Executive Summary & Vision	3**](#heading=)

[1.1 The Product	3](#heading=)

[1.2 Core Principles	3](#heading=)

[**Section 2 — The Main Brain & Learner Brain Architecture	3**](#heading=)

[**Section 3 — Low-Functioning Neurodiverse Learner Support	4**](#heading=)

[**Section 4 — AI Agentic Subject Tutors (14 Tutors, Full K–12 Coverage)	4**](#heading=)

[4.1 Core Tutors (Current 7\)	4](#heading=)

[4.2 Expansion Tutors (New 7 — Full K–12 Coverage)	4](#heading=)

[4.3 Subscription Bundles	5](#heading=)

[4.4 Tutor Adaptation by Functioning Level	5](#heading=)

[4.5 Tutor Provisioning & Deprovisioning	6](#heading=)

[**Section 5 — Homework Helper (Tutor-Gated)	6**](#heading=)

[**Section 6 — Category-Leader Features	6**](#heading=)

[6.1 Parent-Child Co-Learning Mode	6](#heading=)

[6.2 Therapist/BCBA Integration Portal	6](#heading=)

[6.3 Sensory Profile Engine	6](#heading=)

[6.4 IEP Meeting Progress Reports	7](#heading=)

[6.5 Regression Detection with Causal Analysis	7](#heading=)

[6.6 AAC System Bi-Directional Integration	7](#heading=)

[6.7 Sibling Profile Awareness	7](#heading=)

[6.8 Teacher Lesson Plan Generator	7](#heading=)

[6.9 Transition Planning Module (Ages 14–22)	8](#heading=)

[6.10 Multilingual Brain	8](#heading=)

[**Section 7 — Parent Approval, Collaboration & Gamification	8**](#heading=)

[**Section 8 — Technical Architecture	8**](#heading=)

[8.1 Service Map (15+ Services)	8](#heading=)

[8.2 Key Database Additions (Category-Leader Features)	9](#heading=)

[**Section 9 — Enterprise Readiness & Remediation	9**](#heading=)

[**Section 10 — Modular Build Protocol & Module Gates	9**](#heading=)

[**Section 11 — Resolved Design Decisions	10**](#heading=)

# **Section 1 — Executive Summary & Vision**

## **1.1 The Product**

AIVO is an AI-native adaptive learning platform for children on the autism spectrum and all neurodiverse learners. At its core is The Main Brain — a master AI agent that clones itself for each learner based on parent assessment, IEP upload, and baseline assessment. That Learner Brain permanently evolves as a personal AI tutor, content adapter, progress tracker, and family collaborator. Every lesson is generated live by the Brain. Parents subscribe to up to 14 AI Agentic Subject Tutors covering every K–12 domain, from Math and ELA to Speech therapy, Life Skills, and World Languages. Each tutor reads the learner’s Brain and teaches in the way the learner best learns. No learner is left behind — including low-functioning neurodiverse learners at PRE\_SYMBOLIC communication levels.

## **1.2 Core Principles**

1. **Every learner gets their own Brain** — no shared, static content tracks

2. **No learner is left behind** — adapts to ALL functioning levels including non-verbal and pre-symbolic

3. **All content is generated, never pre-authored** — LLM creates lessons at delivery time shaped by the Brain

4. **14 AI Tutors cover every K–12 domain** — Math, ELA, Science, History, Coding, Speech, SEL, Social Studies, Music, PE/Health, World Languages, STEM Design, Life Skills, Creative Writing

5. **IEPs are first-class inputs** — parsed documents directly inform Brain clone and content generation

6. **Parents are co-pilots** — significant Brain changes require parent awareness and approval

7. **Therapists and BCBAs can integrate** — clinical professionals get read-only Brain access and goal alignment

8. **The Brain detects and explains regression** — causal analysis correlating session patterns, breaks, and environmental factors

9. **The platform serves two markets, one architecture** — B2C families and B2B enterprise districts

10. **Enterprise readiness is non-negotiable** — API docs, DR, coverage, pen testing, SOC 2 are first-class deliverables

# **Section 2 — The Main Brain & Learner Brain Architecture**

The Main Brain is a singleton AI agent with three layers: Curriculum Knowledge Base (RAG with pgvector), LLM Reasoning & Generation (Anthropic Claude primary, Google Gemini secondary, OpenAI GPT tertiary via LiteLLM), and Pedagogical Model (PyTorch BKT/DKT). Each Learner Brain is a persistent clone containing: Learner Context Layer (PostgreSQL JSONB \+ Redis), Per-skill Mastery Model, Episodic Memory, Curriculum Alignment, Accommodation Config, IEP Profile, Functioning Level Profile, Sensory Profile, Active Tutor Registry, and Brain Version History. The Brain is versioned with full rollback capability. Regression detection triggers causal analysis and parent notification.

# **Section 3 — Low-Functioning Neurodiverse Learner Support**

Five functioning levels: STANDARD, SUPPORTED, LOW\_VERBAL, NON\_VERBAL, PRE\_SYMBOLIC. Each has a dedicated assessment mode, content generation rules, and interaction modality. The IEP upload is offered before baseline assessment (Step 1b) so parsed data informs assessment mode selection. If IEP and parent signals conflict, the system uses the MORE SUPPORTIVE level. Functional curriculum tracking covers Communication, Self-Care, Social-Emotional, Pre-Academic, and Motor/Sensory domains.

# **Section 4 — AI Agentic Subject Tutors (14 Tutors, Full K–12 Coverage)**

## **4.1 Core Tutors (Current 7\)**

| Tutor | Subject | Persona | SKU |
| :---- | :---- | :---- | :---- |
| **Nova** | Mathematics | Cosmos-themed, visual explanations, step-by-step problem solving | ADDON\_TUTOR\_MATH |
| **Sage** | English Language Arts | Narrative-driven, vocabulary in context, reading comprehension | ADDON\_TUTOR\_ELA |
| **Spark** | Science | Experiment-first, hypothesis-driven, lab simulations | ADDON\_TUTOR\_SCIENCE |
| **Chrono** | History | Time-travel narrative, primary source analysis, cause-and-effect | ADDON\_TUTOR\_HISTORY |
| **Pixel** | Coding & Computer Science | Pair-programming, block-based to text-based progression | ADDON\_TUTOR\_CODING |
| **Echo** | Speech & Language | Articulation practice, language modeling, conversation scaffolding, AAC integration | ADDON\_TUTOR\_SPEECH |
| **Harmony** | Social-Emotional Learning | Emotion identification, self-regulation strategies, social stories, conflict resolution | ADDON\_TUTOR\_SEL |

## **4.2 Expansion Tutors (New 7 — Full K–12 Coverage)**

| Tutor | Subject Domain | Persona & Approach | SKU |
| :---- | :---- | :---- | :---- |
| **Atlas** | Social Studies / Geography / Civics | Explorer-themed, map-based discovery, current events analysis, civic participation projects | ADDON\_TUTOR\_SOCIAL\_STUDIES |
| **Cadence** | Music & Arts | Rhythm-based learning, creative expression, music theory through play, art analysis. Evidence-based: music therapy is proven for ASD engagement. | ADDON\_TUTOR\_ARTS |
| **Vigor** | Physical Education / Health & Wellness | Movement coach, body awareness, motor planning, interoception exercises, visual exercise guides. Critical for neurodiverse learners with motor planning challenges. | ADDON\_TUTOR\_PE\_HEALTH |
| **Lingua** | World Languages | Cultural immersion, conversation partner, bilingual scaffolding. Supports Spanish, French, Mandarin, ASL. Adapts to learner’s communication profile. | ADDON\_TUTOR\_LANGUAGES |
| **Forge** | Engineering / STEM Design / Maker | Design-challenge-based, hands-on projects, NGSS engineering practices. Pairs with Science \+ Coding tutors for cross-disciplinary learning. | ADDON\_TUTOR\_STEM\_DESIGN |
| **Compass** | Life Skills / Transition / Vocational | Real-world task trainer, functional academics, money management, job skills, community navigation. Covers IDEA transition planning (age 14+). No competitor addresses this. | ADDON\_TUTOR\_LIFE\_SKILLS |
| **Muse** | Creative Writing / Journalism / Media Literacy | Storytelling, portfolio-building, media analysis, digital citizenship. Separates creative expression from academic ELA for deeper engagement. | ADDON\_TUTOR\_CREATIVE\_WRITING |

## **4.3 Subscription Bundles**

| Bundle | Included | Price Point |
| :---- | :---- | :---- |
| **Core 7** | Nova, Sage, Spark, Chrono, Pixel, Echo, Harmony | $14.99/mo (included in Premium plan) |
| **Full K–12 (14 Tutors)** | All 14 tutors — complete subject coverage | $24.99/mo or included in Enterprise |
| **Individual Add-On** | Any single tutor | $4.99/mo each |
| **Subject Packs** | STEM Pack (Nova+Spark+Pixel+Forge), Humanities Pack (Sage+Chrono+Atlas+Muse), Wellness Pack (Echo+Harmony+Vigor+Compass) | $9.99/mo per pack |

## **4.4 Tutor Adaptation by Functioning Level**

| Level | All Tutors Adapt To |
| :---- | :---- |
| **STANDARD** | Full interactive sessions with Socratic method, text-based exchanges |
| **SUPPORTED** | Simpler language, more visual aids, shorter exchanges, frequent encouragement |
| **LOW\_VERBAL** | Picture-based exchanges, 2-choice responses, audio-first, adult co-view mode, 3–5 min sessions |
| **NON\_VERBAL** | Partner-assisted mode — adult facilitates, tutor generates activity guides for adult to run with child |
| **PRE\_SYMBOLIC** | Tutor becomes parent coaching agent — daily activities, observational guides, milestone tracking |

## **4.5 Tutor Provisioning & Deprovisioning**

On subscription: billing-svc creates subscription\_item, publishes tutor.addon.activated. brain-svc adds to active\_tutors registry, enables homework helper for that subject. On cancellation: 7-day grace period, mastery data preserved permanently, homework helper disabled after grace, resubscription reconnects to existing mastery.

# **Section 5 — Homework Helper (Tutor-Gated)**

Unlocked per-subject when the corresponding tutor is active. Upload via camera capture, photo gallery, PDF, or text paste. Vision AI (Gemini/GPT-4o) extracts text with OCR, handwriting recognition, LaTeX extraction. Brain context loaded for grade-level adaptation. HomeworkAgent uses tutor persona with Socratic guidance. Completion quality feeds back to Brain mastery model. For LOW\_VERBAL: parent-mediated mode. For NON\_VERBAL/PRE\_SYMBOLIC: parent guide mode with functional skill equivalents.

# **Section 6 — Category-Leader Features**

***These features are designed to make AIVO genuinely uncatchable in the adaptive learning market. No competitor currently offers any of these.***

## **6.1 Parent-Child Co-Learning Mode**

Parents can join a tutor session alongside their child. The tutor adapts in real-time to coach the parent on how to support the child. This transforms AIVO from “an app my kid uses” into “a tool that makes me a better parent.” The system generates post-session parent coaching notes: “When Alex got stuck on fractions, here’s what worked: using the pizza visual. Try this at homework time.” Parent co-learning sessions are tracked separately in the Brain’s episodic memory and contribute to the learner’s engagement profile. Retention impact: families who co-learn have significantly higher NPS and lower churn.

## **6.2 Therapist/BCBA Integration Portal**

A new “Therapist” role that ABA therapists, SLPs, and OTs can be invited to by parents. Therapists get: read-only Brain profile access (HIPAA-scoped), ability to align AIVO goals with therapy goals, session notes submission that feeds the Brain, and progress reports formatted for insurance documentation. This makes AIVO a clinical tool, not just an edtech product — a category of one. Implementation: new therapist role in identity-svc, HIPAA-scoped Brain views in brain-svc, therapy\_goals table linked to brain\_recommendations, and progress export formatted per CPT code documentation requirements.

## **6.3 Sensory Profile Engine**

During onboarding, capture the learner’s sensory profile: hyper/hypo-sensitive to visual, auditory, tactile, vestibular, and proprioceptive stimuli. Store in Brain state as sensory\_profile. Use this to dynamically adjust ALL generated content: color intensity (reduce saturation for visual hyper-sensitivity), animation speed (reduce/eliminate for motion sensitivity), sound volume and frequency range, visual complexity (reduce clutter for visual processing challenges), text density per screen, background patterns and contrast levels. Backed by extensive OT research. Implementation: sensory\_profiles table, onboarding questionnaire extensions in assessment-svc, content generation rules in ai-svc, and a “Sensory Settings” panel in the learner’s UI accessible to parents and therapists.

## **6.4 IEP Meeting Progress Reports**

Generate a formatted, printable “IEP Progress Report” that maps AIVO Brain data directly to IEP goal language. Includes: baseline at IEP upload, current performance, trend line with trajectory, session logs as evidence, and accommodation effectiveness metrics. This report uses the exact language structure from the learner’s uploaded IEP goals (“By \[date\], \[student\] will \[skill\] with \[accuracy\] as measured by \[method\]”). Parents bring this to IEP meetings. Teachers and special ed coordinators see AIVO as a documentation partner, not a competing tool. Implementation: new report generator in family-svc, PDF export using pdf-lib, scheduled generation before IEP review dates (tracked in iep\_profiles.review\_date).

## **6.5 Regression Detection with Causal Analysis**

When the Brain detects regression (≥15% mastery drop), it performs causal analysis by correlating: session frequency changes (did the learner take a break?), time-of-day patterns (morning vs. evening performance), new accommodation introduced (was a change counterproductive?), parent-reported environmental factors (medication change, sleep disruption, family stress), school calendar events (holiday transitions, testing periods), and content difficulty spikes. The Brain presents this to the parent as: “Alex’s math mastery dipped this week. This may be related to the 3-day break in sessions and the transition back from holiday. Recommendation: resume with review activities before new content.” Implementation: causal\_analysis\_engine in brain-svc, correlation with brain\_episodes and parent\_reported\_events table, presented via enhanced regression\_alert recommendation type.

## **6.6 AAC System Bi-Directional Integration**

Integrate bi-directionally with AAC systems (Proloquo2Go, TouchChat, LAMP Words for Life) so that vocabulary mastered in AIVO automatically appears in the learner’s AAC device’s active vocabulary, and vocabulary used in AAC feeds into AIVO’s Brain. No edtech or AAC vendor currently does this. Implementation: AAC integration API in integrations-svc, vocabulary sync protocol, parent consent flow for AAC data sharing, Brain updates from AAC usage patterns. Phase 5 delivery alongside AAC device compatibility testing.

## **6.7 Sibling Profile Awareness**

The Brain is aware of sibling relationships within a family account. If Alex (Grade 6\) has mastered a concept that sibling Jamie (Grade 3\) is approaching, the system generates collaborative activities. Shared family quests in the gamification system. Family XP leaderboard (opt-in). Sibling tutoring mode where the older child helps the younger one (with the tutor facilitating), reinforcing both learners’ mastery. Implementation: sibling\_links table, collaborative activity generator in ai-svc, family quest type in learning-svc quests.

## **6.8 Teacher Lesson Plan Generator**

Teachers who access AIVO Brain data can click “Generate Lesson Plan” and receive a Brain-informed, accommodation-compliant lesson plan for their classroom that accounts for all AIVO learners in their class. The plan includes differentiated instruction groups based on Brain data, accommodation requirements per student, suggested activities aligned to the district’s curriculum standards, and formative assessment suggestions. This makes AIVO the teacher’s tool, not competition with the teacher — the \#1 objection in B2B edtech sales. Implementation: lesson\_plan\_generator in learning-svc, teacher dashboard extension, PDF/docx export.

## **6.9 Transition Planning Module (Ages 14–22)**

IDEA requires transition planning at age 14+. The Compass tutor powers a dedicated module tracking: vocational interests and aptitude assessment, independent living skills (cooking, transportation, money management, personal hygiene), community participation skills, self-advocacy and self-determination skills, post-secondary planning (college, vocational training, supported employment). No adaptive learning platform addresses transition — it’s a wide-open market. Implementation: transition\_plans table, Compass tutor integration, parent/teacher/therapist collaborative goal setting, annual transition report generation for IEP meetings.

## **6.10 Multilingual Brain**

Beyond UI translation (i18n): the Brain tracks language dominance per domain for bilingual learners. Tutor sessions allow code-switching (e.g., explain math in Spanish, practice in English). Content generation scaffolds between languages. The Brain learns which language the learner processes faster per subject and adapts accordingly. Critical for target districts (LAUSD, Houston ISD, Miami-Dade) where 30–50% of learners are bilingual. Implementation: language\_profile in Brain state, bilingual content rules in ai-svc, Lingua tutor serves as the primary multilingual engine, code-switching detection in tutor sessions.

# **Section 7 — Parent Approval, Collaboration & Gamification**

Parent Approval Loop: 13+ recommendation types with persistent approval lifecycle (APPROVE/DECLINE/ADJUST). Profile Collaboration: Parent (ultimate authority), Teacher (collaborative, read-only Brain, submit insights), Caregiver (observation only), Therapist/BCBA (new — clinical read-only, therapy goal alignment). Gamification: 11 subsystems (XP, streaks, badges, currency, avatar shop, quests, multiplayer, leaderboard, daily challenges, SEL, breaks) with functioning-level-aware adaptations and Brain integration.

# **Section 8 — Technical Architecture**

## **8.1 Service Map (15+ Services)**

identity-svc (gateway, auth, SendGrid), brain-svc (Python/FastAPI — Brain clone, mastery, recommendations, sensory profiles, causal analysis), learning-svc (sessions, paths, quests, lesson plan generator), engagement-svc (XP, streaks, badges, shop, multiplayer), family-svc (parent dashboard, IEP reports, data export), tutor-svc (provisioning, sessions, homework orchestration), comms-svc (SendGrid async, push, in-app), billing-svc (Stripe, tutor add-ons, bundles), admin-svc (tenants, analytics), integrations-svc (Clever, ClassLink, LTI, AAC integration), i18n-svc (translations), assessment-svc (parent assessment, baseline, functioning level routing), research-svc (anonymized data), status-page-svc (health), ai-svc (Python/FastAPI — LiteLLM, content generation, agents, OCR, sensory-aware content rules).

## **8.2 Key Database Additions (Category-Leader Features)**

| Table | Purpose |
| :---- | :---- |
| **sensory\_profiles** | Per-learner sensory sensitivity scores (visual, auditory, tactile, vestibular, proprioceptive). Hyper/hypo/typical per modality. |
| **therapy\_sessions** | Therapist-submitted session notes and goal alignment data. HIPAA-scoped. |
| **therapy\_goals** | Therapist-defined goals linked to Brain recommendations and IEP goals. |
| **parent\_reported\_events** | Parent-reported environmental factors (medication changes, sleep, stress, school events) for causal analysis. |
| **sibling\_links** | Family-level sibling relationships for collaborative learning features. |
| **transition\_plans** | IDEA transition planning data (vocational, independent living, community, self-advocacy, post-secondary). |
| **language\_profiles** | Per-learner language dominance per subject domain for bilingual Brain support. |
| **lesson\_plans** | Teacher-generated, Brain-informed lesson plans with differentiation data. |
| **aac\_vocabulary\_sync** | Bi-directional vocabulary sync log between AIVO and AAC devices. |
| **causal\_analyses** | Brain regression causal analysis results with correlated factors and confidence scores. |

# **Section 9 — Enterprise Readiness & Remediation**

Current enterprise maturity: 54/140 (38.6%). Critical blockers: API Documentation (1/10), Disaster Recovery (3/10), Code Coverage (5/10). Remediation roadmap: Phase 1 (Weeks 1–3) resolves critical blockers to 55%. Phase 2 (Weeks 3–6) adds pen testing, circuit breakers, smoke tests, a11y to reach 72%. Phase 3 (Weeks 6–10) adds Vault, Langfuse, Loki, Renovate, ADRs to reach 88%. Phase 4 (Weeks 10–12) adds SOC 2, multi-region replication, blue-green deployment to reach 95%+. See Phase-by-Phase Build Guide for complete implementation details.

# **Section 10 — Modular Build Protocol & Module Gates**

Every module must pass an 11-point gate: 95% E2E coverage (Playwright, real services), 80% unit coverage (c8/pytest-cov, CI gates), zero stubs in production, all routes wired, all buttons click-through, cross-module integration verified, error handling complete, performance baseline met, email templates brand-compliant (SendGrid), UI/UX brand-compliant (axe-core, responsive, dark mode), and OpenAPI specs generated. Module dependency: 0A (Infra) → 0B (Auth) → 1A (Assessment) → 1B (Brain) → 2A (Content) → 2B (Tutors) → 3A (Homework) \+ 3B (Collaboration). Gamification modules (4A–4E) can parallelize after 2A. Enterprise modules (5A–5B) after 1B. Category-leader features (6A–6E) integrate into Phases 2–5.

# **Section 11 — Resolved Design Decisions**

| \# | Decision | Resolution |
| :---- | :---- | :---- |
| 1 | Tutor count | 14 tutors covering all K–12 domains. Core 7 at launch, Expansion 7 in Phase 3–4. |
| 2 | Tutor bundling | Individual ($4.99), Subject Packs ($9.99), Core 7 ($14.99/Premium), Full 14 ($24.99/Enterprise). |
| 3 | Therapist access | New Therapist role with HIPAA-scoped read-only Brain access and therapy goal alignment. |
| 4 | Sensory profile | Formal sensory profile engine captured at onboarding, dynamically adjusts all content. |
| 5 | IEP meeting reports | Auto-generated progress reports matching IEP goal language structure. |
| 6 | Regression analysis | Causal analysis correlating session patterns, environmental factors, and calendar events. |
| 7 | AAC integration | Bi-directional vocabulary sync with Proloquo2Go, TouchChat, LAMP. Phase 5\. |
| 8 | Sibling awareness | Brain-aware sibling profiles with collaborative activities and family quests. |
| 9 | Teacher lesson plans | Brain-informed, accommodation-compliant lesson plan generator for teachers. |
| 10 | Transition planning | Compass tutor powers IDEA-compliant transition module (age 14+). |
| 11 | Multilingual Brain | Language dominance tracking per domain, code-switching in tutor sessions. |
| 12 | Parent co-learning | Parents can join tutor sessions with real-time coaching. |
| 13 | Content generation | All LLM-generated. Anthropic → Google → OpenAI via LiteLLM. No lesson library. |
| 14 | Functioning levels | 5 levels (STANDARD through PRE\_SYMBOLIC). Most supportive level wins on conflict. |
| 15 | Module gating | 95% E2E, 80% unit, zero stubs, OpenAPI specs, brand compliance. |
| 16 | Enterprise DR | Multi-region (HEL1 \+ FSN1). RTO \<4h, RPO \<1h. Weekly backup restore tests. |

*End of PRD — See companion document: Phase-by-Phase Build Guide*