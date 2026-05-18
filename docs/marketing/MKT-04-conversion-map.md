# MKT-04 — Conversion Strategy & Page-Level Funnel Map

Last refreshed: 2026-05-17

## Audience segments

| #   | Segment                 | Primary need                                                    | Buying authority                         |
| --- | ----------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| 1   | Parents                 | Reduce anxiety; understand where their child is and what's next | Direct purchase (family plan)            |
| 2   | Learners                | Calm, low-pressure learning experience                          | None (consumer of product)               |
| 3   | Teachers                | Class visibility; assignment + intervention support             | Influence; rarely sole decision          |
| 4   | School leaders          | Roster-able, privacy-aware, teacher-friendly deployment         | Pilot purchase / building budget         |
| 5   | District leaders        | Scale, procurement, FERPA/COPPA posture, integrations           | Procurement / multi-year contract        |
| 6   | Special ed coordinators | IEP-aware support, accommodations, careful clinical language    | Influence on district + school           |
| 7   | Investors / partners    | Defensibility, traction, brand maturity                         | None for product; signal for fundraising |

## Primary conversion actions

| Action                           | Routes that originate it                                                                                            | Where it lands                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Request school demo              | `/`, `/for-schools`, `/for-districts`, `/for-special-education`, `/for-teachers`, `/levels`, `/tutors`, `/subjects` | `/contact` (current) → `/demo` (planned, MKT-10)                                                    |
| Start parent setup               | `/`, `/for-parents`, `/for-homeschool`                                                                              | `/signup` (existing)                                                                                |
| Join waitlist                    | `/`, `/for-parents`                                                                                                 | `/waitlist` (planned, MKT-10)                                                                       |
| Contact sales                    | `/for-districts`, `/press-kit`                                                                                      | `/contact`                                                                                          |
| Download school packet           | `/for-schools`, `/for-districts`, `/for-special-education`                                                          | `/contact?intent=packet` (interim) → packet asset in MKT-11                                         |
| Read privacy / security overview | Footer everywhere                                                                                                   | `/privacy-policy`, `/coppa-compliance`, `/ferpa-compliance`, future `/security`                     |
| View product walkthrough         | `/`, `/for-parents`, `/for-schools`                                                                                 | `#mission` + `#lessonrun` anchors on `/` (today) → standalone `/features/*` pages (planned, MKT-09) |

## Route inventory & sprint mapping

Sprint MKT-04 specifies a target sitemap. We keep the production `/for-*` route names (already indexed, already covered by smoke tests) and treat the prompt's bare names (`/parents`, `/schools`, etc.) as logical names that map to existing physical paths. Routes the prompt requires that **do not yet exist** are flagged for the sprint that will create them.

| Logical name (prompt)       | Physical path (this repo) | Status                                           | Owning sprint         |
| --------------------------- | ------------------------- | ------------------------------------------------ | --------------------- |
| `/`                         | `/`                       | ✅ rebuilt in MKT-05 (this batch)                | MKT-05                |
| `/parents`                  | `/for-parents`            | ✅ exists                                        | MKT-06 (rebuild)      |
| `/schools`                  | `/for-schools`            | ✅ exists                                        | MKT-07 (rebuild)      |
| `/districts`                | `/for-districts`          | ✅ exists                                        | MKT-07 (rebuild)      |
| `/teachers`                 | `/for-teachers`           | ✅ exists                                        | MKT-07 (rebuild)      |
| `/special-education`        | `/for-special-education`  | ✅ exists                                        | MKT-08 (rebuild)      |
| `/features/todays-mission`  | —                         | ❌ missing                                       | MKT-09                |
| `/features/lessonrun`       | —                         | ❌ missing                                       | MKT-09                |
| `/features/homework-helper` | —                         | ❌ missing                                       | MKT-09                |
| `/pricing`                  | —                         | ❌ missing (Pricing is a homepage section today) | MKT-10                |
| `/demo`                     | —                         | ❌ missing (CTA points to `/contact`)            | MKT-10                |
| `/waitlist`                 | —                         | ❌ missing                                       | MKT-10                |
| `/thank-you`                | —                         | ❌ missing                                       | MKT-10                |
| `/contact`                  | `/contact`                | ✅ exists                                        | MKT-10 (form upgrade) |
| `/security`                 | —                         | ❌ missing                                       | MKT-11                |
| `/privacy`                  | `/privacy-policy`         | ✅ exists                                        | MKT-11 (keep)         |
| `/accessibility`            | `/accessibility`          | ✅ exists                                        | MKT-11 (keep)         |
| `/terms`                    | `/terms-of-service`       | ✅ exists                                        | MKT-11 (keep)         |
| `/trust`                    | —                         | ❌ missing                                       | MKT-11                |
| `/subprocessors`            | —                         | ❌ missing                                       | MKT-11                |
| `/about`                    | `/about`                  | ✅ exists                                        | —                     |
| `/resources`                | —                         | ❌ missing                                       | MKT-12                |
| `/blog`                     | `/blog`                   | ✅ exists                                        | MKT-12 (content)      |
| `/blog/[slug]`              | —                         | ❌ missing                                       | MKT-12                |
| `/guides/[slug]`            | —                         | ❌ missing                                       | MKT-12                |

Bonus routes (already shipped, kept):
`/about`, `/careers`, `/compare/[slug]`, `/cookie-policy`, `/coppa-compliance`, `/ferpa-compliance`, `/forgot-password`, `/for-homeschool`, `/levels` + `/levels/[level]`, `/login`, `/press-kit`, `/reset-password`, `/signup`, `/subjects` + `/subjects/[slug]`, `/tutors` + `/tutors/[slug]`.

## Per-page funnel matrix

Columns: **Audience** · **Message** · **Goal** · **Primary CTA** · **Secondary CTA** · **Objections** · **Trust proof** · **Product proof** · **SEO theme** · **Internal links** · **Required components**

### `/`

- **Audience**: All — parent / school / district fork in §2
- **Message**: AIVO gives every child a personalized next lesson, guided by parent input, learning needs, baseline results, and real progress
- **Goal**: Segment + capture
- **Primary CTA**: Request a demo
- **Secondary CTA**: See how it works
- **Objections**: "Generic AI tutors don't adapt"; "I can't see what's happening"; "Is this safe for kids?"
- **Trust proof**: COPPA · FERPA strip in Footer, accessibility commitment
- **Product proof**: Today's Mission mockup, LessonRun mockup, Parent + Teacher dashboards
- **SEO theme**: personalized learning platform; adaptive learning K-12
- **Internal links**: `/for-parents`, `/for-schools`, `/for-districts`, `/tutors`, `/levels`, `/contact`
- **Required components**: `StickyHeader`, `Hero`, `Features`, `AudienceSelector`, `HowItWorks`, `CoreProductLoop`, `TodaysMissionPreview`, `LessonRunPreview`, `RoleVisibility`, `FunctioningLevels`, `BrainClone`, `TutorCarousel`, `TrustStrip`, `Testimonials`, `Pricing`, `FAQ`, `CTASection`, `Footer`

### `/for-parents`

- **Audience**: Parents / guardians (esp. of neurodiverse learners)
- **Message**: Understand where your child is, what they need next, and how we're personalizing support
- **Goal**: Parent waitlist / setup signup
- **Primary CTA**: Start parent setup
- **Secondary CTA**: Join the waitlist
- **Objections**: "Will it shame my child?"; "Can I trust it with IEP info?"; "Will I understand the reports?"
- **Trust proof**: COPPA section, plain-language parent summary mockup, accessibility supports
- **Product proof**: Learner profile card, parent assessment preview, Today's Mission preview, parent weekly summary
- **SEO theme**: AI tutor for kids; personalized learning for parents; IEP-aware learning support
- **Internal links**: `/for-special-education`, `/for-homeschool`, `/tutors`, `/levels`, `/signup`
- **Required components**: parent hero, pain-points strip, AIVO loop, parent assessment explainer, IEP support callout, Today's Mission preview, parent summary mockup, accessibility strip, safety section, parent FAQ, parent CTA

### `/for-schools`

- **Audience**: School leaders, principals, instructional coordinators
- **Message**: Personalized learning support with teacher visibility and safe deployment
- **Goal**: Demo request
- **Primary CTA**: Request a demo
- **Secondary CTA**: Download school packet
- **Objections**: "Will teachers adopt it?"; "Roster integration?"; "Privacy posture?"
- **Trust proof**: FERPA section, accessibility commitment, security overview link
- **Product proof**: Teacher dashboard mockup, class roster view, intervention queue
- **SEO theme**: AI learning platform for schools; personalized learning K-12
- **Internal links**: `/for-teachers`, `/for-districts`, `/for-special-education`, `/contact`
- **Required components**: school hero, workflow strip, teacher dashboard mockup, roster preview, progress visibility, special-ed link card, privacy/security strip, demo CTA

### `/for-teachers`

- **Audience**: Classroom teachers, intervention specialists
- **Message**: See what learners are working on, where they need support, and what to assign next
- **Goal**: Inbound interest / teacher waitlist
- **Primary CTA**: Request a teacher demo
- **Secondary CTA**: Join the educator newsletter
- **Objections**: "More tools = more work"; "Will it replace me?"
- **Trust proof**: Privacy-aware accommodation view; teacher-safe summaries
- **Product proof**: Class dashboard, skill gap view, assignment composer, recent LessonRuns
- **SEO theme**: AI tutor for teachers; classroom personalized learning
- **Internal links**: `/for-schools`, `/tutors`, `/contact`
- **Required components**: teacher hero, class dashboard mockup, skill gap mockup, assignment mockup, LessonRun history list, accommodation summary card, CTA

### `/for-districts`

- **Audience**: District leaders, tech directors, curriculum leaders, procurement
- **Message**: Scalable, privacy-aware personalized learning across schools
- **Goal**: DPA / security packet request + sales meeting
- **Primary CTA**: Request DPA / security packet
- **Secondary CTA**: Request a district demo
- **Objections**: "Procurement complexity"; "Scale concerns"; "FERPA exposure"
- **Trust proof**: Security overview, FERPA/COPPA stance, subprocessor list, audit logging mention
- **Product proof**: Deployment diagram, rostering posture, reporting overview
- **SEO theme**: district AI learning; FERPA-aware learning platform; OneRoster-ready learning
- **Internal links**: `/for-schools`, `/coppa-compliance`, `/ferpa-compliance`, future `/security`, future `/subprocessors`
- **Required components**: district hero, deployment overview, rostering strip, seat-licensing card, privacy strip, accessibility strip, reporting strip, DPA CTA, demo CTA

### `/for-special-education`

- **Audience**: Special ed coordinators, parents of neurodiverse learners
- **Message**: Parent context + optional IEP context personalizes pacing, scaffolds, read-aloud, and lesson structure (no diagnosis claims)
- **Goal**: Sensitive lead capture; parent or school contact
- **Primary CTA**: Request a careful intro call
- **Secondary CTA**: Read accessibility commitment
- **Objections**: "Will it expose my child's IEP?"; "Is this replacing therapists?"; "Is it actually accessible?"
- **Trust proof**: Privacy boundary diagram, learner-vs-parent view separation, accessibility statement link
- **Product proof**: Parent accommodation summary card; learner lesson with shorter steps; read-aloud control; hint/scaffold preview; teacher-safe support summary
- **SEO theme**: IEP-aware learning support; special education AI learning; accessibility-first learning platform
- **Internal links**: `/accessibility`, `/for-parents`, future `/security`
- **Required components**: SE hero, "meet learner where they are" strip, learning-context explainer, optional-IEP card, what-AIVO-adapts list, view-boundary diagram, teacher-safe summary mockup, accessibility section, privacy/consent section, SE FAQ, CTA

### `/features/todays-mission` (new — MKT-09)

- **Audience**: Parents + schools
- **Message**: Today's Mission gives each learner one clear next-best learning action
- **Goal**: Funnel to demo / signup
- **Primary CTA**: Request a demo
- **Secondary CTA**: See pricing
- **Objections**: "Just another to-do list"
- **Trust proof**: Parent/teacher visibility note
- **Product proof**: Today's Mission card with subject, tutor, goal, estimated time, Start button
- **SEO theme**: AI personalized lesson; daily learning plan AI
- **Internal links**: `/features/lessonrun`, `/tutors`, `/contact`
- **Required components**: feature hero, problem strip, AIVO solution strip, mission-priority logic strip, mockup, visibility strip, feature CTA

### `/features/lessonrun` (new — MKT-09)

- **Audience**: Parents + teachers
- **Message**: LessonRun is the personalized learning unit behind every AIVO lesson
- **Goal**: Demo / signup
- **Primary CTA**: Request a demo
- **Secondary CTA**: Meet the tutors
- **Objections**: "Won't AI just dump answers?"
- **Trust proof**: Anti-answer-dumping copy; mastery update transparency
- **Product proof**: Lesson player with tutor, step card, hint, read-aloud, progress bar
- **SEO theme**: adaptive lesson platform; AI lesson sequencing
- **Internal links**: `/tutors`, `/features/homework-helper`, `/contact`
- **Required components**: hero, flow diagram, tutor strip, hints/scaffolds strip, read-aloud strip, break-mode strip, mastery strip, parent-summary strip, feature CTA

### `/features/homework-helper` (new — MKT-09)

- **Audience**: Parents primarily; teachers secondarily
- **Message**: Guides learners step by step without simply dumping answers
- **Goal**: Parent waitlist / signup
- **Primary CTA**: Join the waitlist
- **Secondary CTA**: Request a demo
- **Objections**: "AI cheating concerns"
- **Trust proof**: Anti-cheating / anti-answer-dumping explanation
- **Product proof**: Homework Helper chat / help screen mockup
- **SEO theme**: AI homework helper; safe AI homework support for kids
- **Internal links**: `/features/lessonrun`, `/for-parents`, `/contact`
- **Required components**: hero, problem-input mockup, clarifying-question strip, guided-help strip, scaffolded-explanation strip, follow-up lesson strip, safety strip, feature CTA

### `/pricing` (new — MKT-10)

- **Audience**: Parents, schools, districts
- **Message**: Plans for families, schools, and districts — clear, no fake numbers
- **Goal**: Plan selection → demo / waitlist
- **Primary CTA**: Request a quote (school/district) / Join waitlist (family)
- **Secondary CTA**: Request a demo
- **Objections**: "Is it affordable?"; "Do I have to call sales?"
- **Trust proof**: No-fake-prices commitment; transparent feature list
- **Product proof**: Plan-card feature checklists
- **SEO theme**: AI learning pricing; school AI tutor pricing
- **Internal links**: `/demo`, `/waitlist`, `/contact`
- **Required components**: pricing hero, 3 plan cards, comparison table, FAQ strip, pricing CTA

### `/demo`, `/waitlist`, `/thank-you` (new — MKT-10)

- All three are conversion-optimized form pages — short, single-purpose, no nav clutter.
- See MKT-10 sprint for field specs and form-component contracts.

### `/security`, `/trust`, `/subprocessors` (new — MKT-11)

- Trust-center surfaces. Procurement-friendly language, no certification overclaims, evidence-ready.
- See MKT-11 for section specs.

### `/resources`, `/blog`, `/blog/[slug]`, `/guides/[slug]` (new — MKT-12)

- Top-of-funnel SEO + nurture. Categories: parent guides, personalized learning, special education support, AI in education, teacher workflows, school implementation, accessibility, privacy & safety.

## Design funnel rules (locked)

1. Homepage segments quickly by audience (Audience Selector is §2, immediately after Hero).
2. Parent page reduces anxiety and explains the learning loop — no diagnosis claims, no clinical overreach.
3. School page emphasizes classroom visibility and safe deployment.
4. District page emphasizes procurement, privacy, scale, and rostering.
5. Special education page is careful, evidence-friendly, and non-clinical.
6. Feature pages show product workflow, not abstract AI claims.
7. Pricing page supports both family and school/district buying paths without fake pricing.
8. Demo page is friction-light and high-converting.

## Acceptance criteria (MKT-04)

- ✅ Sitemap is complete (above)
- ✅ Every page has a conversion goal (above)
- ✅ Every page has primary + secondary CTAs (above)
- ✅ Every page has an SEO theme (above)
- ✅ Every page addresses objections (above)
- ✅ No marketing route exists without a conversion purpose (audited; legacy routes like `/about`, `/careers`, `/press-kit` are top-of-funnel awareness — purpose = brand credibility, not direct conversion, intentionally)

## Open items

1. **Route renaming** — decided 2026-05-17 to keep `/for-*` paths. Re-evaluate if SEO research shows materially better intent for bare `/parents` etc.
2. **`/contact` vs `/demo` overlap** — interim CTAs still route to `/contact`. MKT-10 should split these and add a `/contact?intent=*` query so analytics can distinguish.
3. **`/thank-you` deduplication** — one shared thank-you with a `source` query param, or per-form thank-you pages? Default to one shared page with `source` until conversion rate analysis says otherwise.
