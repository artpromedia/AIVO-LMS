# **AIVO Learning v2 — Updated UI/UX Sprint Prompt Suite**

## **Sprint Sequence**

Sprint UX-00 — Product Design Reset and UX Audit  
Sprint UX-01 — Information Architecture and Route-to-Screen Matrix  
Sprint UX-02 — Visual Design System and Component Library  
Sprint UX-03 — Auth, Consent, Privacy, and Onboarding UX  
Sprint UX-04 — Parent Web App UX  
Sprint UX-05 — Learner Web and Tablet UX  
Sprint UX-06 — Lesson Player UX  
Sprint UX-07 — Baseline Assessment UX  
Sprint UX-08 — Subjects, Mastery, and Today’s Mission UX  
Sprint UX-09 — Quest Worlds and Homework Helper UX  
Sprint UX-10 — Teacher Web App UX  
Sprint UX-11 — School, District, and Platform Admin UX  
Sprint UX-12 — Unified Mobile App Architecture and Role Switching UX  
Sprint UX-13 — Unified Mobile Role Experiences: Parent, Learner, Teacher, Admin-Lite  
Sprint UX-14 — Accessibility, Inclusive Design, and WCAG Audit  
Sprint UX-15 — AI Generation States, Safety States, and Error Recovery UX  
Sprint UX-16 — Notifications, Rostering, Billing, Settings, and Language UX  
Sprint UX-17 — Prototype Testing, Design QA, and Engineering Handoff

---

# **Global UI/UX Rules for Every Sprint**

\# Global AIVO UI/UX Rules

You are designing AIVO Learning v2, a personalized agentic K–12 learning platform with strong support for neurodiverse learners, IEPs, accommodations, parent visibility, teacher insight, and school/district administration.

AIVO must not feel like a generic LMS.

It must be a next-best-lesson product.

Every learner screen must answer:  
\- What should I do now?  
\- Who is helping me?  
\- What will I learn?  
\- How long will it take?  
\- What happens when I finish?

Every parent screen must answer:  
\- What is my child working on?  
\- What is helping them?  
\- Where are they struggling?  
\- What should happen next?  
\- Is AIVO honoring their learning needs?

Every teacher screen must answer:  
\- Which learners need attention?  
\- What skills are they working on?  
\- What support was used?  
\- What should I assign or review next?

Every admin screen must answer:  
\- What is happening operationally?  
\- What needs attention?  
\- What can be audited?  
\- What has failed?  
\- What is the next administrative action?

Non-negotiable design rules:  
\- No dead buttons.  
\- No placeholder routes.  
\- No fake progress.  
\- No dashboard-first learner experience.  
\- No generic mock baseline language.  
\- No raw IEP content in learner UI.  
\- No learner-facing diagnostic labels.  
\- No lesson starts without a LessonRun.  
\- No quest progress without completed learning.  
\- Every screen must have loading, empty, error, success, and retry states where relevant.  
\- Every flow must work on desktop, tablet, mobile web, and native mobile where applicable.  
\- Accessibility must be built into the design from the start.  
\- Parent copy must be plain-language and reassuring.  
\- Learner copy must be supportive and non-shaming.  
\- Teacher copy must be instructional and privacy-aware.  
\- Admin copy must be precise, operational, and audit-friendly.  
\- The mobile product must be one unified AIVO app with role-based modes, not separate apps.

Design outputs must include:  
\- Screen purpose  
\- Primary CTA  
\- Secondary actions  
\- Required data  
\- API/data dependency notes  
\- Empty state  
\- Loading state  
\- Error state  
\- Retry behavior  
\- Permission rules  
\- Consent dependency  
\- Accessibility notes  
\- Mobile behavior  
\- Engineering handoff notes

---

# **Sprint UX-00 — Product Design Reset and UX Audit**

\# Sprint UX-00: Product Design Reset and UX Audit

You are the lead UX auditor and product designer for AIVO Learning v2.

Your task is to audit the existing or planned UI/UX and identify every gap that would prevent the app from becoming a complete, trustworthy, school-ready, parent-friendly, learner-centered product.

AIVO is not dashboard-first. It is next-best-lesson-first.

Audit the product against this core journey:  
1\. Parent signs up.  
2\. Parent verifies account.  
3\. Parent gives required consent.  
4\. Parent creates learner.  
5\. Parent completes assessment.  
6\. Parent uploads or skips IEP/accommodation document.  
7\. AIVO creates learner brain profile.  
8\. AIVO generates personalized baseline.  
9\. Learner completes baseline.  
10\. AIVO creates mastery map.  
11\. Learner sees Today’s Mission.  
12\. Learner starts a LessonRun.  
13\. Tutor generates personalized lesson.  
14\. Learner completes lesson.  
15\. AIVO updates progress.  
16\. Parent sees plain-language summary.  
17\. Learner continues through subjects, quests, homework, assignments, and review.

Audit for:  
\- Broken routes  
\- Dead buttons  
\- Placeholder screens  
\- Confusing navigation  
\- Dashboard-first learner screens  
\- Missing learner next action  
\- Missing parent next action  
\- Missing teacher instructional action  
\- Missing admin operational action  
\- Missing loading states  
\- Missing empty states  
\- Missing error states  
\- Missing retry states  
\- Missing permission states  
\- Missing consent states  
\- Missing AI generation states  
\- Missing mobile role-switching states  
\- Missing unified mobile app states  
\- Missing offline mobile states  
\- Inconsistent visual language  
\- Inconsistent component usage  
\- Accessibility violations  
\- Unclear copy  
\- Unnecessary clinical language  
\- Raw IEP exposure risks  
\- Fake gamification  
\- Quest progress not tied to real learning  
\- Parent progress summaries that are too technical  
\- Teacher views exposing more sensitive data than needed  
\- Admin screens that are not audit-friendly

Deliver:  
1\. UX audit report  
2\. Broken flow list  
3\. Missing screen list  
4\. Missing state list  
5\. Design debt backlog  
6\. Accessibility risk list  
7\. Privacy/IEP exposure risk list  
8\. Learner confusion risk list  
9\. Parent trust risk list  
10\. Teacher/admin usability risk list  
11\. Unified mobile app risk list  
12\. Recommended redesign priorities

Acceptance criteria:  
\- The audit covers every primary user role.  
\- The audit covers web, tablet, mobile web, and native mobile.  
\- The audit identifies all missing states.  
\- The audit identifies every place where the learner lacks a clear next action.  
\- The audit identifies every place where parent trust may break.  
\- The audit identifies every place where sensitive data could be exposed.  
\- The audit identifies whether mobile was incorrectly split into separate app concepts.  
\- The audit produces a prioritized redesign backlog.

---

# **Sprint UX-01 — Information Architecture and Route-to-Screen Matrix**

\# Sprint UX-01: Information Architecture and Route-to-Screen Matrix

Design the complete information architecture for AIVO Learning v2 across web, tablet, and one unified mobile app.

Roles:  
1\. Parent / Guardian  
2\. Learner  
3\. Teacher  
4\. School Admin  
5\. District Admin  
6\. Platform Admin

Default web role homes:  
\- Parent: /parent/home  
\- Learner: /learner/home  
\- Teacher: /teacher/home  
\- School Admin: /admin/school  
\- District Admin: /admin/district  
\- Platform Admin: /admin/platform

Unified mobile role modes:  
\- Parent Mode  
\- Learner Mode  
\- Teacher Mode  
\- Admin-Lite Mode

Create a complete route-to-screen matrix.

For every route or mobile screen, define:  
\- Route path or screen key  
\- Screen name  
\- Role  
\- Device type  
\- Screen purpose  
\- Primary CTA  
\- Secondary actions  
\- Required data  
\- API/BFF dependency  
\- Loading state  
\- Empty state  
\- Error state  
\- Retry behavior  
\- Permission rule  
\- Consent dependency  
\- Accessibility notes  
\- Mobile behavior  
\- Engineering notes

Include route groups for:

Authentication:  
\- Signup  
\- Login  
\- Verify email  
\- Forgot password  
\- Reset password  
\- Account recovery

Parent web:  
\- Parent home  
\- Learners  
\- Add learner  
\- Learner profile  
\- Parent assessment  
\- Assessment review  
\- IEP upload  
\- IEP review  
\- Brain profile summary  
\- Baseline status  
\- Progress dashboard  
\- Lesson history  
\- Accessibility settings  
\- Notification settings  
\- Billing  
\- Privacy and data requests

Learner web/tablet:  
\- Profile select  
\- Learner home  
\- Today’s Mission  
\- Baseline player  
\- Lesson player  
\- Subjects  
\- Subject detail  
\- Quests  
\- Quest world  
\- Quest chapter  
\- Homework Helper  
\- Progress  
\- Accessibility settings

Teacher web:  
\- Teacher home  
\- Classes  
\- Class detail  
\- Learner detail  
\- Assignments  
\- Create assignment  
\- Assignment tracking

Admin web:  
\- School admin dashboard  
\- District admin dashboard  
\- Platform admin dashboard  
\- User management  
\- Tenant management  
\- School management  
\- Rostering  
\- AI generation monitoring  
\- Safety review  
\- Audit logs  
\- Curriculum management  
\- Billing  
\- Compliance  
\- Security  
\- Support  
\- System health

Unified mobile:  
\- Welcome  
\- Login  
\- Signup  
\- Role chooser  
\- Role switcher  
\- Parent Mode home  
\- Parent Mode learners  
\- Parent Mode progress  
\- Parent Mode notifications  
\- Parent Mode settings  
\- Learner Mode today  
\- Learner Mode lesson  
\- Learner Mode subjects  
\- Learner Mode quests  
\- Learner Mode homework  
\- Learner Mode progress  
\- Teacher Mode home  
\- Teacher Mode classes  
\- Teacher Mode learners  
\- Teacher Mode assignments  
\- Teacher Mode notifications  
\- Admin-Lite Mode alerts  
\- Admin-Lite Mode AI failures  
\- Admin-Lite Mode rostering status  
\- Admin-Lite Mode support  
\- Shared account settings  
\- Shared accessibility settings  
\- Shared language settings  
\- Shared notification center

Deliver:  
1\. Web sitemap  
2\. Unified mobile sitemap  
3\. Role-based navigation model  
4\. Route-to-screen matrix  
5\. Permission map  
6\. Consent dependency map  
7\. Mobile role-switching model  
8\. Breadcrumb and contextual navigation rules  
9\. Screen priority by MVP, school-ready release, and enterprise release

Acceptance criteria:  
\- Every primary route has a screen.  
\- Every screen has a purpose.  
\- Every screen has a primary CTA.  
\- Every screen has required states.  
\- Every route is mapped to role and permission.  
\- Learner navigation centers Today’s Mission.  
\- Parent navigation centers learner readiness and progress.  
\- Teacher navigation centers classes, learners, and assignments.  
\- Admin navigation centers operational controls and auditability.  
\- Mobile is designed as one unified app with role-based modes.

---

# **Sprint UX-02 — Visual Design System and Component Library**

\# Sprint UX-02: Visual Design System and Component Library

Design the complete AIVO Learning v2 visual design system.

The design system must support:  
\- Web app  
\- One unified mobile app with role-based modes  
\- Tablet learner experience  
\- Parent dashboard  
\- Learner lesson player  
\- Teacher dashboard  
\- Admin console  
\- Accessibility modes  
\- Future dark mode  
\- High contrast mode  
\- Dyslexia-friendly text mode  
\- Reduced motion mode  
\- Language expansion

Design personality:  
\- Warm  
\- Calm  
\- Trustworthy  
\- Intelligent  
\- Friendly  
\- School-credible  
\- Child-safe  
\- Neurodiversity-aware  
\- Modern SaaS quality

Create:

1\. Color System  
\- Primary brand color  
\- Secondary color  
\- Accent colors  
\- Learner reward colors  
\- Parent trust colors  
\- Teacher instructional colors  
\- Admin neutral colors  
\- Success  
\- Warning  
\- Error  
\- Info  
\- Disabled  
\- Focus  
\- High contrast variants  
\- Role mode accents for mobile

2\. Typography  
\- Web scale  
\- Mobile scale  
\- Learner large text scale  
\- Admin data scale  
\- Parent readability scale  
\- Dyslexia-friendly alternate type mode  
\- Line height and paragraph rules

3\. Spacing and Layout  
\- Desktop grid  
\- Tablet grid  
\- Mobile grid  
\- Learner one-task layout  
\- Parent card layout  
\- Teacher class layout  
\- Admin dense-data layout  
\- Unified mobile role shell layout

4\. Components  
\- Button  
\- Icon button  
\- Input  
\- Textarea  
\- Select  
\- Checkbox  
\- Radio group  
\- Toggle  
\- Slider  
\- Card  
\- Mission card  
\- Learner card  
\- Tutor card  
\- Subject card  
\- Lesson step card  
\- Progress card  
\- Assessment question card  
\- IEP upload card  
\- Parent summary card  
\- Teacher assignment card  
\- Quest chapter card  
\- Admin stat card  
\- Data table  
\- Filter bar  
\- Search field  
\- Tabs  
\- Stepper  
\- Dialog  
\- Drawer  
\- Toast  
\- Alert  
\- Badge  
\- Tooltip  
\- Skeleton  
\- Empty state  
\- Error state  
\- Retry panel  
\- Read-aloud control  
\- Hint button  
\- Scaffold panel  
\- Accessibility toolbar  
\- Notification item  
\- Audit log row  
\- Mobile role card  
\- Mobile role switcher  
\- Parent lock modal  
\- Admin re-auth prompt

5\. Interaction States  
\- Default  
\- Hover  
\- Focus  
\- Active  
\- Pressed  
\- Disabled  
\- Loading  
\- Success  
\- Error  
\- Retryable failure  
\- Permission blocked  
\- Consent required  
\- Offline  
\- Session expired  
\- Role unavailable

6\. Motion  
\- Gentle learner celebration  
\- Lesson step transition  
\- Progress update animation  
\- Role switching transition  
\- Reduced-motion alternative  
\- No distracting animation during instruction

Deliver:  
\- Design tokens  
\- Component inventory  
\- Component variants  
\- Usage rules  
\- Do/don’t examples  
\- Accessibility annotations  
\- Responsive behavior  
\- Unified mobile component rules  
\- Engineering handoff notes

Acceptance criteria:  
\- Every core screen can be built from the component system.  
\- All components have focus states.  
\- All interactive components have disabled and loading states.  
\- Mobile role modes reuse one design system.  
\- Design tokens are implementation-ready.  
\- Components are suitable for React, Tailwind, shadcn-style implementation, and native mobile translation.

---

# **Sprint UX-03 — Auth, Consent, Privacy, and Onboarding UX**

\# Sprint UX-03: Auth, Consent, Privacy, and Onboarding UX

Design the authentication, consent, privacy, and parent onboarding experience for AIVO Learning v2.

This product serves K–12 learners and may collect child learning data, parent-provided learner context, optional IEP/accommodation documents, and AI-personalization data. The UX must establish trust before collecting sensitive child data.

Design flows:  
1\. Parent signup  
2\. Email verification  
3\. Login  
4\. Forgot password  
5\. Reset password  
6\. Parent consent overview  
7\. Child data collection consent  
8\. IEP document storage consent  
9\. AI personalization consent  
10\. Teacher/school access explanation  
11\. Learner account activation  
12\. Consent management settings  
13\. Consent revoked state  
14\. Feature unavailable due to missing consent  
15\. Unified mobile login  
16\. Mobile role detection  
17\. Mobile role chooser  
18\. Mobile protected learner handoff

UX principles:  
\- Plain-language privacy explanations  
\- Layered consent  
\- Short summary first  
\- Detailed policy link second  
\- Clear “why we ask this”  
\- Optional consent clearly marked  
\- Required consent clearly explained  
\- No legal wall of text as the primary experience  
\- Parent can review consent later  
\- Parent can revoke optional consent  
\- Learner cannot activate without parent-approved setup  
\- Mobile learner mode must not expose parent privacy, billing, consent, or IEP management

Design screens:  
\- Signup  
\- Login  
\- Verify email  
\- Forgot password  
\- Reset password  
\- Consent overview  
\- Consent detail  
\- Consent success  
\- Consent missing  
\- Consent revoked  
\- Learner activation  
\- Privacy settings  
\- Data export request  
\- Data deletion request  
\- IEP deletion request  
\- Mobile role chooser  
\- Mobile role switcher  
\- Parent lock  
\- Session expired

Deliver:  
\- Auth flow map  
\- Consent flow map  
\- Privacy UX copy  
\- Desktop screens  
\- Mobile screens  
\- Error states  
\- Revoked consent states  
\- Consent-required states  
\- Mobile role protection states  
\- Engineering handoff notes

Acceptance criteria:  
\- Parent understands what data AIVO collects and why.  
\- Parent can complete consent without confusion.  
\- Parent can skip optional IEP upload.  
\- Feature access reflects consent status.  
\- Sensitive features have clear privacy explanations.  
\- No learner data collection flow bypasses consent UX.  
\- Mobile role switching respects consent, permissions, and learner privacy.

---

# **Sprint UX-04 — Parent Web App UX**

\# Sprint UX-04: Parent Web App UX

Design the complete parent web experience for AIVO Learning v2.

The parent experience must help parents:  
\- Create learners  
\- Complete learning profiles  
\- Upload or skip IEP documents  
\- Understand learner readiness  
\- Review brain profile summaries  
\- Monitor progress  
\- Manage accessibility  
\- Manage notifications  
\- Manage billing and privacy settings

Parent UX qualities:  
\- Clear  
\- Calm  
\- Trustworthy  
\- Plain-language  
\- Non-clinical  
\- Helpful  
\- Reassuring

Design screens:  
1\. Parent home  
2\. Learner list  
3\. Add learner  
4\. Learner profile  
5\. Setup checklist  
6\. Parent assessment wizard  
7\. Parent assessment review  
8\. IEP upload  
9\. IEP extraction status  
10\. Accommodation summary  
11\. Brain profile summary  
12\. Baseline status  
13\. Progress dashboard  
14\. Recent lessons  
15\. Lesson summary detail  
16\. Subject progress  
17\. Accessibility settings  
18\. Notification settings  
19\. Billing settings  
20\. Privacy and data requests

Parent home must show:  
\- Learner cards  
\- Readiness state  
\- Next required action  
\- Recent progress  
\- Notifications  
\- Add learner CTA

Progress dashboard must show:  
\- What child worked on  
\- What child practiced  
\- What went well  
\- Where child needed help  
\- What supports AIVO used  
\- Recommended next step  
\- Subject progress  
\- Lesson history  
\- Accommodation alignment

Use parent-friendly examples:  
\- “AIVO gave shorter steps today.”  
\- “Your child used read-aloud support.”  
\- “Your child needed one extra hint on subtraction.”  
\- “A short review tomorrow may help.”

Do not:  
\- Show raw IEP text casually.  
\- Use diagnostic labels in a casual way.  
\- Make parents interpret AI metrics.  
\- Overload parent home with dense charts.

Deliver:  
\- Parent sitemap  
\- Parent user flows  
\- Desktop wireframes  
\- High-fidelity parent screens  
\- Empty/loading/error states  
\- Multiple learner switching design  
\- UX copy recommendations  
\- Engineering handoff notes

Acceptance criteria:  
\- Parent can complete setup end-to-end.  
\- Parent always sees the next action.  
\- Parent can understand progress without technical interpretation.  
\- Parent can manage multiple learners.  
\- Parent can control accessibility preferences.  
\- Parent can manage privacy and consent settings.

---

# **Sprint UX-05 — Learner Web and Tablet UX**

\# Sprint UX-05: Learner Web and Tablet UX

Design the learner web and tablet experience for AIVO Learning v2.

The learner experience is the heart of the product. It must not feel like a dashboard. It must feel like a guided learning journey where the learner always knows the next best action.

Learner UX qualities:  
\- Simple  
\- Encouraging  
\- Low-clutter  
\- Accessible  
\- Neurodiversity-aware  
\- Tutor-supported  
\- Rewarding  
\- Calm  
\- Not overwhelming

Primary learner flows:  
1\. Select learner profile  
2\. See Today’s Mission  
3\. Start or resume lesson  
4\. Complete baseline  
5\. Complete lesson  
6\. Use hint  
7\. Use scaffold  
8\. Use read-aloud  
9\. Take a break  
10\. Complete lesson  
11\. See celebration  
12\. View next step  
13\. Browse subjects  
14\. Start quest  
15\. Use Homework Helper  
16\. View simple progress

Design screens:  
\- Learner profile select  
\- Learner home  
\- Today’s Mission  
\- Baseline start  
\- Lesson player entry  
\- Subjects  
\- Subject detail  
\- Quest worlds  
\- Quest chapter  
\- Homework Helper  
\- Simple progress  
\- Accessibility controls

Learner home must show:  
\- Today’s Mission as the dominant element  
\- Tutor  
\- Subject  
\- Goal  
\- Estimated time  
\- Why this matters  
\- Start/continue CTA  
\- Secondary links to Subjects, Quests, Homework Helper, Progress

Design rules:  
\- One primary action per screen  
\- Large buttons  
\- Large readable text  
\- Clear progress indicator  
\- Avoid dense menus  
\- Avoid shame language  
\- Avoid harsh “wrong” feedback  
\- Use supportive correction  
\- Do not show diagnostic labels  
\- Do not show raw IEP content  
\- Resume after refresh must feel seamless

Deliver:  
\- Learner flow map  
\- Tablet-first wireframes  
\- Desktop learner screens  
\- Mobile web adaptation  
\- Component list  
\- Accessibility behavior  
\- Empty/loading/error states  
\- Engineering handoff notes

Acceptance criteria:  
\- Learner home clearly answers “what should I do now?”  
\- Learner can start or resume Today’s Mission.  
\- Learner can access subjects, quests, homework, and progress.  
\- Learner screens are not dashboard-first.  
\- Learner UI is accessible, low-clutter, and supportive.

---

# **Sprint UX-06 — Lesson Player UX**

\# Sprint UX-06: Lesson Player UX

Design the AIVO Lesson Player, the most important learner-facing screen in the product.

Every learner lesson is backed by a LessonRun.

Lesson flow:  
1\. Welcome  
2\. Goal  
3\. Story hook  
4\. Micro-lesson  
5\. Example  
6\. Guided practice  
7\. Hint/scaffold  
8\. Check understanding  
9\. Celebration  
10\. Progress update  
11\. Next step

Design requirements:  
\- One step at a time  
\- No clutter  
\- Friendly tutor presence  
\- Large text  
\- Large buttons  
\- Read-aloud control  
\- Hint button  
\- Scaffold button  
\- Take-a-break button  
\- Progress indicator  
\- Autosave status  
\- Resume after refresh  
\- Reduced-motion support  
\- High-contrast support  
\- Dyslexia-friendly mode  
\- Keyboard accessibility  
\- Touch accessibility  
\- Screen-reader support  
\- Native mobile compatibility inside Learner Mode

Design states:  
\- Lesson generating  
\- Lesson ready  
\- Lesson in progress  
\- Step complete  
\- Incorrect answer with support  
\- Hint opened  
\- Scaffold opened  
\- Read-aloud active  
\- Break mode  
\- Connection interrupted  
\- Autosaving  
\- Resume available  
\- Lesson completed  
\- Lesson failed with retry  
\- Offline resume unavailable  
\- Mobile role interrupted  
\- Parent lock required for leaving learner mode

Microcopy rules:  
\- Replace “Wrong” with “Let’s try another way.”  
\- Use “Here’s a hint.”  
\- Use “You’re building this skill.”  
\- Use “Great effort.”  
\- Use “Ready for the next step?”  
\- Make hints feel helpful, not punitive.

Deliver:  
\- Full lesson player wireframes  
\- Desktop layout  
\- Tablet layout  
\- Native mobile layout inside Learner Mode  
\- Interaction states  
\- Microcopy  
\- Accessibility annotations  
\- Engineering handoff requirements

Acceptance criteria:  
\- Learner can complete a full LessonRun.  
\- Learner can request hints and scaffolds.  
\- Learner can use read-aloud.  
\- Learner can take a break.  
\- Learner can resume after refresh.  
\- Learner can complete LessonRun inside unified mobile app Learner Mode.  
\- Completion leads to progress update and next step.

---

# **Sprint UX-07 — Baseline Assessment UX**

\# Sprint UX-07: Baseline Assessment UX

Design the personalized baseline assessment experience.

The baseline must feel supportive, not like a high-stakes test. It should help AIVO understand where to begin.

The baseline is generated from:  
\- Learner profile  
\- Grade band  
\- Parent assessment  
\- IEP/accommodations where provided  
\- Subject area  
\- Known strengths and weaknesses

Design screens:  
1\. Baseline readiness screen  
2\. Baseline purpose explanation  
3\. Baseline generating state  
4\. Baseline question screen  
5\. Hint/support state  
6\. Read-aloud state  
7\. Break state  
8\. Answer submitted state  
9\. Baseline complete  
10\. Results processing  
11\. Parent baseline summary  
12\. Learner next step  
13\. Mobile Learner Mode baseline player  
14\. Mobile Parent Mode baseline status

Design requirements:  
\- Friendly explanation  
\- Low-pressure language  
\- One question at a time  
\- Large controls  
\- Read-aloud support  
\- Break option  
\- Accommodation-aware interface  
\- Progress indicator  
\- No generic “mock question” language  
\- No diagnostic language  
\- No grade-shaming  
\- Retry and resume support

Parent baseline summary should show:  
\- Baseline completed  
\- Starting areas  
\- Strengths noticed  
\- Support settings used  
\- Recommended first lesson  
\- No overly technical scoring

Deliver:  
\- Baseline flow  
\- Learner baseline screens  
\- Parent baseline summary screens  
\- Mobile Learner Mode baseline screens  
\- Mobile Parent Mode baseline status  
\- Loading/error/retry states  
\- Accessibility notes  
\- Engineering handoff notes

Acceptance criteria:  
\- Learner understands baseline purpose.  
\- Learner can complete baseline without feeling judged.  
\- Baseline supports read-aloud and breaks.  
\- Parent can understand results in plain language.  
\- Baseline completion leads to mastery map and Today’s Mission.

---

# **Sprint UX-08 — Subjects, Mastery, and Today’s Mission UX**

\# Sprint UX-08: Subjects, Mastery, and Today’s Mission UX

Design the UX for subject paths, mastery visualization, and Today’s Mission.

Today’s Mission is the learner’s daily entry point.

Mission priority:  
1\. Resume in-progress lesson.  
2\. Continue active quest lesson.  
3\. Address baseline weakness.  
4\. Continue next unmastered skill.  
5\. Schedule review.  
6\. Parent-assigned lesson.  
7\. Teacher-assigned lesson.

Design screens:  
\- Learner home with Today’s Mission  
\- Mission detail  
\- Mission generating  
\- Mission ready  
\- Mission resume  
\- Subject list  
\- Subject detail  
\- Skill progress  
\- Recommended lesson  
\- Mastery update  
\- Parent subject progress view  
\- Teacher skill gap view  
\- Mobile Learner Mode Today  
\- Mobile Learner Mode Subjects  
\- Mobile Parent Mode Progress  
\- Mobile Teacher Mode Skill Gap Summary

Subject areas:  
\- Math  
\- Reading  
\- Writing  
\- Science  
\- Social Studies  
\- Homework Helper

Today’s Mission card must show:  
\- Subject  
\- Tutor  
\- Goal  
\- Estimated time  
\- Why this matters  
\- Start or continue button  
\- Progress if in progress

Mastery visualization rules:  
\- Learner view should be simple and encouraging.  
\- Parent view should be plain-language.  
\- Teacher view may be more instructional.  
\- Admin view may be more data-oriented.  
\- Avoid technical scoring in learner UI.

Deliver:  
\- Today’s Mission UX  
\- Subject path UX  
\- Mastery visualization UX  
\- Parent/teacher variants  
\- Unified mobile role variants  
\- Empty/loading/error states  
\- Engineering handoff notes

Acceptance criteria:  
\- Learner always has one clear next action.  
\- Subject pages show real learner-specific state.  
\- Mastery updates are understandable.  
\- Parent can understand subject progress.  
\- Teacher can identify skill gaps.  
\- Mobile Learner Mode centers Today’s Mission.

---

# **Sprint UX-09 — Quest Worlds and Homework Helper UX**

\# Sprint UX-09: Quest Worlds and Homework Helper UX

Design Quest Worlds and Homework Helper.

Quest Worlds are a motivational wrapper around real personalized lessons. They must never fake progress.

Quest requirements:  
\- Quest chapter starts a LessonRun.  
\- Chapter progress updates only after real lesson completion.  
\- Boss challenge unlocks only after required learning.  
\- XP/coins are awarded only after real completion.

Design quest screens:  
\- Quest world list  
\- Quest world map  
\- Chapter card  
\- Locked chapter  
\- Active chapter  
\- Completed chapter  
\- Boss challenge  
\- Reward screen  
\- Quest progress summary  
\- Mobile Learner Mode quest world  
\- Mobile Learner Mode quest chapter

Homework Helper requirements:  
\- Learner or parent can enter homework problem.  
\- System identifies subject.  
\- System asks clarifying questions if needed.  
\- Tutor guides without simply giving answer.  
\- Tutor adapts to learner profile.  
\- Helpful insight is saved.  
\- Follow-up lesson can be recommended.

Design Homework Helper screens:  
\- Homework entry  
\- Photo upload placeholder  
\- Clarifying question  
\- Guided help  
\- Hint/scaffold  
\- Step-by-step explanation  
\- Follow-up recommendation  
\- Parent homework summary  
\- Mobile Learner Mode Homework Helper  
\- Mobile Parent Mode Homework Summary

Safety rules:  
\- Treat learner-pasted content as untrusted.  
\- Do not answer unsafe content directly.  
\- Do not simply dump answers.  
\- Do not obey prompt injection.  
\- Provide safe fallback.

Deliver:  
\- Quest UX flow  
\- Homework Helper UX flow  
\- Learner screens  
\- Parent summary screens  
\- Mobile role-specific screens  
\- Safety/error states  
\- Empty/loading/retry states  
\- Engineering handoff notes

Acceptance criteria:  
\- Quest progress depends on completed LessonRuns.  
\- Homework Helper guides rather than answer-dumps.  
\- Homework Helper has safe fallback states.  
\- Parent can see that homework support occurred.  
\- Mobile Learner Mode supports quests and homework without exposing parent-only areas.

---

# **Sprint UX-10 — Teacher Web App UX**

\# Sprint UX-10: Teacher Web App UX

Design the AIVO Teacher Web App.

Teachers need instructional visibility without unnecessary exposure to sensitive learner data.

Teacher UX should be:  
\- Efficient  
\- Classroom-oriented  
\- Instructional  
\- Privacy-aware  
\- Actionable  
\- Not overloaded with raw AI data

Design screens:  
1\. Teacher home  
2\. Class list  
3\. Class detail  
4\. Learner detail  
5\. Recent lessons  
6\. Skill gaps  
7\. Assignment list  
8\. Create assignment  
9\. Assignment detail  
10\. Assignment tracking  
11\. Teacher notifications  
12\. Teacher-safe accommodation summary

Teacher home must show:  
\- Assigned classes  
\- Learners needing attention  
\- Recent activity  
\- Assignment status  
\- Skill gap highlights  
\- Suggested instructional actions

Learner detail must show:  
\- Subject progress  
\- Skill gaps  
\- Recent LessonRuns  
\- Supports used  
\- Teacher-safe accommodation summary  
\- Assignment history  
\- Recommended next assignment

Privacy rules:  
\- Do not show raw IEP.  
\- Show only instructional support summaries.  
\- Respect roster scope.  
\- Avoid unnecessary sensitive information.  
\- Explain support usage in classroom-relevant language.

Deliver:  
\- Teacher sitemap  
\- Dashboard wireframes  
\- Learner detail screen  
\- Assignment creation flow  
\- Empty/loading/error states  
\- Privacy annotations  
\- Engineering handoff notes

Acceptance criteria:  
\- Teacher can view assigned learners.  
\- Teacher can identify skill gaps.  
\- Teacher can create assignments.  
\- Teacher can track assignment completion.  
\- Teacher cannot see unauthorized learner data.  
\- Teacher view is privacy-aware.

---

# **Sprint UX-11 — School, District, and Platform Admin UX**

\# Sprint UX-11: School, District, and Platform Admin UX

Design the AIVO Admin Console for school admins, district admins, and platform admins.

The admin console must feel:  
\- Enterprise-grade  
\- Operational  
\- Audit-friendly  
\- Secure  
\- Clear  
\- Dense where appropriate  
\- Not visually childish

Admin roles:

School Admin:  
\- Users  
\- Learners  
\- Teachers  
\- Classes  
\- Rostering  
\- Reports  
\- Billing status  
\- Support requests  
\- School audit logs

District Admin:  
\- Schools  
\- District-wide usage  
\- Reports  
\- Rostering overview  
\- Contract and seat overview  
\- Compliance exports  
\- Support trends

Platform Admin:  
\- Tenants  
\- Users  
\- AI generation monitoring  
\- Safety monitoring  
\- Audit logs  
\- Billing  
\- Support  
\- Curriculum  
\- Compliance  
\- Security  
\- System health  
\- AI cost controls  
\- Prompt/model versions  
\- Incident management

Design screens:  
\- School admin dashboard  
\- District admin dashboard  
\- Platform admin dashboard  
\- User management  
\- Tenant management  
\- School hierarchy  
\- Roster import  
\- AI generation monitoring  
\- Safety review queue  
\- Audit logs  
\- Billing and seats  
\- Compliance center  
\- Security controls  
\- Curriculum management  
\- Support queue  
\- System health  
\- Incident dashboard

Admin UX requirements:  
\- Strong filtering  
\- Strong search  
\- Clear status badges  
\- Export actions  
\- Detail drawers  
\- Confirmation for destructive actions  
\- No hidden destructive actions  
\- Audit-friendly views  
\- Clear failure/retry states  
\- Mobile Admin-Lite must not attempt to replace full desktop admin

Deliver:  
\- Admin IA  
\- Role-specific navigation  
\- Dashboard layouts  
\- Data table patterns  
\- Filter/search patterns  
\- Detail page templates  
\- Empty/loading/error states  
\- Admin-Lite boundary notes  
\- Engineering handoff notes

Acceptance criteria:  
\- School admin is scoped to school.  
\- District admin is scoped to district.  
\- Platform admin can manage platform-wide operations.  
\- AI failures are visible.  
\- Safety review queue is usable.  
\- Audit logs are searchable.  
\- Admin console supports enterprise review.

---

# **Sprint UX-12 — Unified Mobile App Architecture and Role Switching UX**

\# Sprint UX-12: Unified Mobile App Architecture and Role Switching UX

Design the unified AIVO mobile app.

AIVO should be one mobile app with role-based experiences, not separate parent and learner apps.

The app must support:  
\- Parent Mode  
\- Learner Mode  
\- Teacher Mode  
\- Admin-Lite Mode

The app must allow role-aware routing after login.

A user may have one role or multiple roles. If the user has multiple roles, show a role chooser after login. If the user has one role, route directly to that role’s home.

Core mobile app principles:  
\- One app binary.  
\- Shared authentication.  
\- Shared notification center.  
\- Shared account settings.  
\- Shared accessibility preferences.  
\- Shared language preferences.  
\- Role-specific home screens.  
\- Role-specific navigation.  
\- Strong learner privacy boundaries.  
\- Parent lock for protected learner actions.  
\- No raw IEP content in learner mode.  
\- No diagnostic labels in learner mode.  
\- Teacher views are roster-scoped.  
\- Admin-lite views are operational, not full desktop admin replacement.

Design the following:

1\. Mobile Welcome  
\- Brand introduction  
\- Login  
\- Signup  
\- School/district login option placeholder

2\. Authentication  
\- Login  
\- Signup  
\- Verify email  
\- Forgot password  
\- Reset password  
\- Account recovery

3\. Role Detection  
\- Single-role direct routing  
\- Multi-role chooser  
\- Role cards  
\- Last-used role shortcut  
\- Secure role switcher

4\. Role Switcher  
\- Parent Mode  
\- Learner Mode  
\- Teacher Mode  
\- Admin-Lite Mode  
\- Clear visual distinction between modes  
\- Parent lock before entering protected learner settings  
\- Session timeout handling

5\. Shared Mobile Shell  
\- Notification center  
\- Account settings  
\- Privacy settings  
\- Accessibility settings  
\- Language settings  
\- Help/support  
\- Logout

6\. Shared States  
\- Loading  
\- Empty  
\- Error  
\- Retry  
\- Offline  
\- Session expired  
\- Permission denied  
\- Consent required  
\- Role unavailable

7\. Security and Safety  
\- Learner mode must not expose parent settings.  
\- Learner mode must not expose billing, privacy, consent, or raw IEP content.  
\- Parent mode can manage learners.  
\- Teacher mode can access only roster-scoped learners.  
\- Admin-lite mode requires elevated role and may require re-authentication.

Deliver:  
\- Unified mobile app sitemap  
\- Role switching flow  
\- Shared mobile shell design  
\- Role-aware navigation model  
\- Permission and consent state designs  
\- Mobile design tokens  
\- Engineering handoff notes

Acceptance criteria:  
\- One mobile app supports all roles.  
\- Single-role users route directly to their home.  
\- Multi-role users can choose role.  
\- Role switching is clear and secure.  
\- Learner mode is protected from sensitive parent/admin content.  
\- Parent can manage learners from the same app.  
\- Teacher can access roster-scoped learners.  
\- Admin-lite can view critical operational alerts.

---

# **Sprint UX-13 — Unified Mobile Role Experiences**

\# Sprint UX-13: Unified Mobile Role Experiences for the AIVO App

Design the role-specific mobile experiences inside the unified AIVO mobile app.

The app has four primary role modes:  
1\. Parent Mode  
2\. Learner Mode  
3\. Teacher Mode  
4\. Admin-Lite Mode

Each role mode should feel purpose-built while sharing the same app foundation.

\#\# Parent Mode

Primary navigation:  
\- Home  
\- Learners  
\- Progress  
\- Notifications  
\- Settings

Design screens:  
\- Parent home  
\- Learner switcher  
\- Learner detail  
\- Add learner  
\- Parent assessment  
\- IEP upload  
\- Accommodation summary  
\- Brain profile summary  
\- Progress dashboard  
\- Lesson summary  
\- Notifications  
\- Accessibility settings  
\- Consent settings  
\- Billing  
\- Privacy/data export  
\- Account/security

Parent Mode requirements:  
\- Parent sees setup status.  
\- Parent sees child progress.  
\- Parent can manage multiple learners.  
\- Parent can manage consent.  
\- Parent can manage accessibility.  
\- Parent can review notifications.  
\- Parent can manage billing and privacy.

\#\# Learner Mode

Primary navigation:  
\- Today  
\- Subjects  
\- Quests  
\- Homework  
\- Progress

Design screens:  
\- Learner profile select  
\- Learner home  
\- Today’s Mission  
\- Baseline player  
\- Lesson player  
\- Subjects  
\- Subject detail  
\- Quest worlds  
\- Quest chapter  
\- Homework Helper  
\- Simple progress  
\- Accessibility controls  
\- Break mode  
\- Celebration

Learner Mode requirements:  
\- Today’s Mission is dominant.  
\- One task per screen.  
\- Large buttons.  
\- Large readable text.  
\- Hint button.  
\- Scaffold button.  
\- Read-aloud control.  
\- Break button.  
\- Supportive correction language.  
\- No raw IEP content.  
\- No diagnostic labels.  
\- Parent lock for protected settings.

\#\# Teacher Mode

Primary navigation:  
\- Home  
\- Classes  
\- Learners  
\- Assignments  
\- Notifications

Design screens:  
\- Teacher home  
\- Class list  
\- Class detail  
\- Learner detail  
\- Skill gaps  
\- Recent LessonRuns  
\- Assignment list  
\- Create assignment  
\- Assignment tracking  
\- Teacher notifications

Teacher Mode requirements:  
\- Teacher sees assigned learners only.  
\- Teacher can identify skill gaps.  
\- Teacher can create assignments.  
\- Teacher can track assignment completion.  
\- Teacher sees instructional support summaries only.  
\- Teacher does not see unnecessary sensitive IEP details.

\#\# Admin-Lite Mode

Primary navigation:  
\- Alerts  
\- Users  
\- Rostering  
\- AI  
\- Support

Design screens:  
\- Admin-lite home  
\- Critical alerts  
\- AI generation failures  
\- Roster import status  
\- Support queue  
\- User lookup  
\- Incident notice  
\- System health summary

Admin-Lite requirements:  
\- This is not a full replacement for desktop admin.  
\- Show urgent operational information only.  
\- Allow quick triage.  
\- Require elevated permission.  
\- Sensitive actions may require re-authentication.  
\- Destructive admin actions should be desktop-only unless explicitly approved.

Shared mobile requirements:  
\- Thumb-friendly controls.  
\- Large tap targets.  
\- Loading, empty, error, and retry states.  
\- Offline-aware states.  
\- Push notification-ready patterns.  
\- High contrast support.  
\- Reduced motion support.  
\- Screen-reader support.  
\- Language preference support.

Deliver:  
\- Parent Mode mobile screens  
\- Learner Mode mobile screens  
\- Teacher Mode mobile screens  
\- Admin-Lite mobile screens  
\- Shared notification center  
\- Shared settings screens  
\- Role switcher screens  
\- Mobile permission states  
\- Mobile consent states  
\- Engineering handoff notes

Acceptance criteria:  
\- Parent can complete core setup on mobile.  
\- Learner can complete Today’s Mission and LessonRun on mobile.  
\- Teacher can review classes and create assignments on mobile.  
\- Admin-lite can triage operational alerts on mobile.  
\- Role boundaries are clear.  
\- Sensitive data is protected by role.  
\- The app feels unified, not like four unrelated apps.

---

# **Sprint UX-14 — Accessibility, Inclusive Design, and WCAG Audit**

\# Sprint UX-14: Accessibility, Inclusive Design, and WCAG Audit

Design and audit AIVO Learning v2 for accessibility and inclusive learning.

AIVO supports K–12 learners, including neurodiverse learners and students with individualized learning needs. Accessibility must exist across the full product, not only in settings.

Audit and design for:  
\- WCAG 2.2 AA alignment  
\- Keyboard navigation  
\- Focus management  
\- Screen-reader support  
\- Color contrast  
\- Touch target size  
\- Reduced motion  
\- High contrast  
\- Large text  
\- Dyslexia-friendly text mode  
\- Read-aloud  
\- Transcript fallback  
\- Plain-language copy  
\- Low cognitive load  
\- Error recovery  
\- Break reminders  
\- Shorter steps  
\- Extra hints  
\- Unified mobile accessibility  
\- Role switching accessibility  
\- Parent lock accessibility

Create:  
1\. Accessibility checklist  
2\. Learner UI accessibility rules  
3\. Parent UI accessibility rules  
4\. Teacher/admin accessibility rules  
5\. Component-level accessibility annotations  
6\. Screen-level accessibility annotations  
7\. Keyboard navigation map  
8\. Screen-reader label map  
9\. Focus order map  
10\. Mobile accessibility map  
11\. Remediation backlog  
12\. VPAT/ACR evidence checklist

Key learner accessibility requirements:  
\- One task at a time  
\- Clear next action  
\- Avoid dense text  
\- Avoid distracting animation  
\- Provide read-aloud support  
\- Provide visual and text instructions  
\- Make hints easy to request  
\- Make taking a break acceptable  
\- Use supportive correction language

Deliver:  
\- Accessibility audit template  
\- Annotated screen examples  
\- Component accessibility spec  
\- Keyboard navigation map  
\- Screen-reader label map  
\- Mobile accessibility notes  
\- Accessibility remediation backlog  
\- VPAT/ACR preparation checklist

Acceptance criteria:  
\- Primary learner flows pass keyboard-only navigation.  
\- Primary parent flows pass keyboard-only navigation.  
\- Unified mobile role switching is accessible.  
\- Screen-reader labels are defined.  
\- No keyboard traps remain.  
\- Focus order is logical.  
\- Color contrast passes.  
\- Reduced-motion mode is designed.  
\- Read-aloud has transcript fallback.

---

# **Sprint UX-15 — AI Generation States, Safety States, and Error Recovery UX**

\# Sprint UX-15: AI Generation States, Safety States, and Error Recovery UX

Design all UX states related to AI generation, safety validation, moderation, retry, fallback, and timeout handling.

AIVO uses AI for:  
\- Learner brain profile generation  
\- Baseline generation  
\- Lesson generation  
\- Today’s Mission generation  
\- Homework Helper  
\- Parent summaries  
\- Teacher summaries

Design states for:  
1\. Preparing learner brain profile  
2\. Preparing baseline  
3\. Preparing Today’s Mission  
4\. Preparing lesson  
5\. Streaming lesson preparation  
6\. Generation taking longer than expected  
7\. Generation failed  
8\. Retry generation  
9\. Safe fallback  
10\. Content blocked for safety  
11\. Homework input needs clarification  
12\. Homework input blocked  
13\. Prompt-injection neutralized  
14\. AI response under review  
15\. Parent summary generating  
16\. Teacher summary generating  
17\. Mobile generation interrupted  
18\. Mobile app backgrounded during generation  
19\. Mobile offline during generation  
20\. Resume generated content after reopening app

UX rules:  
\- Do not leave users staring at a spinner without context.  
\- Explain what is happening in plain language.  
\- Give the user a safe next step when generation fails.  
\- Do not expose technical AI details to learners.  
\- Use admin-facing diagnostics only in admin screens.  
\- Learners must never see scary safety language.  
\- Parents should receive clear, calm explanations.  
\- Admins should see failure codes and remediation actions.  
\- Mobile users should be able to resume after app interruption.

Create:  
\- AI waiting state components  
\- “Preparing your lesson” experience  
\- Long-running generation state  
\- Timeout state  
\- Retry state  
\- Fallback lesson state  
\- Safety blocked state  
\- Admin failure detail state  
\- Mobile resume state  
\- AI monitoring UI pattern

Deliver:  
\- AI state flow map  
\- Learner AI states  
\- Parent AI states  
\- Teacher AI states  
\- Admin AI states  
\- Unified mobile AI states  
\- Error recovery copy  
\- Retry/fallback patterns  
\- Engineering handoff notes

Acceptance criteria:  
\- Every AI generation has a user-facing state.  
\- Every AI failure has a recovery path.  
\- Learner-facing AI errors are supportive.  
\- Parent-facing AI errors are clear.  
\- Admin-facing AI errors are actionable.  
\- Safety-blocked content has appropriate UX by role.  
\- Mobile generation flows handle interruption, offline, retry, and resume.

---

# **Sprint UX-16 — Notifications, Rostering, Billing, Settings, and Language UX**

\# Sprint UX-16: Notifications, Rostering, Billing, Settings, and Language UX

Design the supporting product surfaces required for school-ready and commercial-ready launch.

Areas:  
1\. Notifications  
2\. Rostering  
3\. Billing  
4\. Account settings  
5\. Privacy settings  
6\. School/district setup  
7\. Seat management  
8\. Language and localization preferences  
9\. Unified mobile shared settings

Notification types:  
\- Parent progress summary  
\- Baseline completed  
\- Lesson completed  
\- Teacher assignment created  
\- Teacher assignment due  
\- Streak reminder  
\- Quest unlocked  
\- IEP extraction ready  
\- Data request completed  
\- Billing notice  
\- Safety review required  
\- Admin incident alert  
\- AI generation failure alert  
\- Roster import failure alert

Rostering UX:  
\- CSV import  
\- Import preview  
\- Error review  
\- Fix roster errors  
\- Class creation  
\- Teacher assignment  
\- Learner enrollment  
\- External SIS connection placeholder  
\- OneRoster-ready mapping

Billing UX:  
\- Parent subscription  
\- Trial  
\- Active plan  
\- Past due  
\- Cancelled  
\- School-paid  
\- District-paid  
\- Seat licensing  
\- Invoices  
\- Payment failure  
\- Upgrade/downgrade  
\- Billing admin view

Settings UX:  
\- Account  
\- Security  
\- Consent  
\- Notifications  
\- Billing  
\- Privacy  
\- Accessibility  
\- Language  
\- Data export  
\- Data deletion  
\- Role switching  
\- Mobile app permissions

Language UX:  
\- Parent language preference  
\- Learner learning language  
\- Tutor language  
\- TTS voice language  
\- Notification language  
\- Admin language fallback  
\- Missing translation fallback

Unified mobile settings:  
\- Shared account settings  
\- Shared accessibility settings  
\- Shared language settings  
\- Shared notification settings  
\- Role-specific protected settings  
\- Parent lock for protected learner settings

Deliver:  
\- Notification center design  
\- Notification preference design  
\- Mobile notification center  
\- Roster import flow  
\- Roster error flow  
\- Billing screens  
\- Seat management screens  
\- Settings screens  
\- Language preference screens  
\- Empty/loading/error states  
\- Engineering handoff notes

Acceptance criteria:  
\- Parent can manage notification preferences.  
\- Teacher assignment notifications are designed.  
\- School admin can import roster.  
\- Roster errors are visible and fixable.  
\- Billing states are clear.  
\- Seat management is understandable.  
\- Settings are organized and searchable.  
\- Unified mobile app has shared settings and role-specific protected settings.  
\- Language preferences affect UI, tutor language, TTS, and notifications where supported.

---

# **Sprint UX-17 — Prototype Testing, Design QA, and Engineering Handoff**

\# Sprint UX-17: Prototype Testing, Design QA, and Engineering Handoff

Create the complete clickable prototype, test plan, design QA checklist, and engineering handoff package for AIVO Learning v2.

Prototype must cover:  
1\. Parent signs up.  
2\. Parent verifies email.  
3\. Parent gives consent.  
4\. Parent creates learner.  
5\. Parent completes assessment.  
6\. Parent uploads or skips IEP.  
7\. Parent sees learner readiness.  
8\. Learner selects profile.  
9\. Learner completes baseline.  
10\. Learner sees Today’s Mission.  
11\. Learner starts LessonRun.  
12\. Learner completes lesson.  
13\. Parent sees progress summary.  
14\. Learner starts quest chapter.  
15\. Teacher creates assignment.  
16\. Admin views AI generation failure.  
17\. Unified mobile user logs in.  
18\. Unified mobile user switches role.  
19\. Parent Mode reviews learner progress.  
20\. Learner Mode completes Today’s Mission.  
21\. Teacher Mode reviews class and assignment.  
22\. Admin-Lite Mode triages AI failure alert.

Prototype requirements:  
\- Web desktop prototype  
\- Tablet learner prototype  
\- Unified mobile app prototype  
\- Parent Mode mobile flow  
\- Learner Mode mobile flow  
\- Teacher Mode mobile flow  
\- Admin-Lite mobile flow  
\- Role switcher flow  
\- Loading states  
\- Empty states  
\- Error states  
\- Retry states  
\- Success states  
\- Offline states  
\- Permission-denied states  
\- Consent-required states  
\- Accessibility mode examples  
\- High contrast examples  
\- Reduced motion examples

User testing plan:  
\- Parent user  
\- Learner user  
\- Teacher user  
\- School admin user  
\- Accessibility reviewer  
\- Mobile user  
\- Neurodiverse learner scenario  
\- Parent managing multiple learners  
\- Teacher managing a class  
\- Admin reviewing AI failure  
\- Multi-role user switching roles  
\- Parent handing device to learner

Design QA checklist:  
\- No primary route missing  
\- No primary button dead  
\- No placeholder UI in core journeys  
\- Parent onboarding works end-to-end  
\- Learner baseline works end-to-end  
\- Today’s Mission can be started and resumed  
\- LessonRun can be completed  
\- Parent can understand progress  
\- Quest progress depends on real learning  
\- Teacher access is privacy-aware  
\- Admin views are audit-friendly  
\- Unified mobile app is designed as one app  
\- Mobile role switching works  
\- Parent Mode is complete  
\- Learner Mode is complete  
\- Teacher Mode is complete  
\- Admin-Lite Mode is scoped to urgent triage  
\- Accessibility issues are documented  
\- Engineering handoff is complete

Engineering handoff must include:  
\- Sitemap  
\- Route-to-screen matrix  
\- User flows  
\- Component inventory  
\- Design tokens  
\- Responsive behavior  
\- Interaction states  
\- Copy deck  
\- Accessibility annotations  
\- Data requirements per screen  
\- API dependency notes  
\- Permission rules  
\- Consent dependency notes  
\- Mobile role-switching rules  
\- Unified mobile app architecture notes  
\- Acceptance criteria per screen

For each screen, include:  
\- Screen name  
\- Route or mobile screen key  
\- Role  
\- Device type  
\- Purpose  
\- Primary CTA  
\- Secondary actions  
\- Required data  
\- Empty state  
\- Loading state  
\- Error state  
\- Retry behavior  
\- Permission rule  
\- Consent dependency  
\- Accessibility notes  
\- Engineering notes

Deliver:  
\- Final clickable prototype  
\- Design QA report  
\- User testing script  
\- Usability findings template  
\- Engineering handoff package  
\- Component spec  
\- Screen acceptance criteria  
\- Implementation backlog

Acceptance criteria:  
\- Prototype covers the full core product loop.  
\- Prototype covers web, tablet, and unified mobile app.  
\- Prototype includes mobile role switching.  
\- Prototype includes failure and retry states.  
\- Design QA checklist passes.  
\- Engineering can implement without guessing.  
\- Every screen has acceptance criteria.

---

# **Updated Final Approval Gate for the UI/UX Redesign**

\# AIVO UI/UX Redesign Final Approval Gate

The UI/UX redesign is not complete unless all of the following are true:

Product Flow:  
\- Parent can complete onboarding end-to-end.  
\- Parent can create learner.  
\- Parent can complete assessment.  
\- Parent can upload or skip IEP.  
\- Learner can complete baseline.  
\- Learner can start Today’s Mission.  
\- Learner can complete a LessonRun.  
\- Parent can understand progress.  
\- Learner can continue through subjects, quests, homework, and review.  
\- Teacher can assign a lesson.  
\- Admin can monitor AI generation and audit logs.

Learner UX:  
\- Learner home is not a dashboard.  
\- Today’s Mission is the dominant action.  
\- Lesson player is one step at a time.  
\- Learner feedback is supportive.  
\- Learner can request hints and scaffolds.  
\- Learner can use read-aloud.  
\- Learner can take a break.  
\- No diagnostic labels appear in learner UI.  
\- No raw IEP text appears in learner UI.

Parent UX:  
\- Parent always sees next setup action.  
\- Parent progress is plain-language.  
\- Parent can manage multiple learners.  
\- Parent can manage consent and privacy.  
\- Parent can manage accessibility settings.  
\- Parent is not forced to interpret technical AI metrics.

Teacher UX:  
\- Teacher sees assigned learners only.  
\- Teacher can identify skill gaps.  
\- Teacher can create assignments.  
\- Teacher sees instructional support summaries.  
\- Teacher does not see unnecessary sensitive IEP details.

Admin UX:  
\- Admin screens are operational and audit-friendly.  
\- AI failures are visible.  
\- Safety review queue exists.  
\- Audit logs are searchable.  
\- Rostering, billing, compliance, and security screens are designed.

Unified Mobile UX:  
\- AIVO is designed as one unified mobile app.  
\- The mobile app has Parent Mode, Learner Mode, Teacher Mode, and Admin-Lite Mode.  
\- Role switching is designed.  
\- Single-role users route directly to their mode.  
\- Multi-role users can choose role.  
\- Parent Mode supports setup, learner management, progress, notifications, and settings.  
\- Learner Mode supports Today’s Mission, LessonRun, baseline, quests, homework, and progress.  
\- Teacher Mode supports classes, learners, assignments, and notifications.  
\- Admin-Lite Mode supports urgent operational triage only.  
\- Shared login, notifications, settings, accessibility, and language preferences exist.  
\- Learner Mode does not expose parent, billing, consent, admin, or raw IEP content.  
\- Teacher Mode is roster-scoped.  
\- Admin-Lite Mode is permission-gated.  
\- Parent can hand the device to a learner without exposing protected parent areas.

Accessibility:  
\- WCAG 2.2 AA target is reflected in designs.  
\- Keyboard navigation is mapped.  
\- Screen-reader labels are defined.  
\- Focus states are defined.  
\- Color contrast is checked.  
\- Reduced motion is supported.  
\- High contrast is supported.  
\- Dyslexia-friendly mode is supported.  
\- Read-aloud has transcript fallback.  
\- Mobile role switching is accessible.

Implementation:  
\- Route-to-screen matrix is complete.  
\- Component system is complete.  
\- Design tokens are complete.  
\- Screen acceptance criteria are complete.  
\- Engineering handoff is complete.  
\- No primary route is missing.  
\- No primary button is dead.  
\- No placeholder UI remains in core journeys.
