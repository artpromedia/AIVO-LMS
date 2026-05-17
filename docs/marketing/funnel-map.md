# AIVO Marketing Funnel Map (MKT-04)

Page-level conversion strategy for `apps/marketing`. Every route below has a single primary conversion goal.

## Audience → Route map

| Audience | Primary route | Secondary routes |
|---|---|---|
| Parent (general) | `/for-parents` | `/`, `/waitlist`, `/pricing` |
| Parent (homeschool) | `/for-homeschool` | `/pricing`, `/for-parents` |
| Teacher | `/for-teachers` | `/demo`, `/contact` |
| School leader | `/for-schools` | `/demo`, `/pricing`, `/security` |
| District leader | `/for-districts` | `/demo`, `/security`, `/subprocessors` |
| Special education coordinator | `/for-special-education` | `/trust`, `/demo` |
| Investor / partner | `/about`, `/press-kit` | `/contact` |

## Page-level funnels

### `/` (homepage)
- **Goal:** Segment + qualify
- **Primary CTA:** Get Started (signup)
- **Secondary CTA:** See how it works (scroll to product loop)
- **Trust proof:** TrustStrip (COPPA-aware, FERPA-aware, SOC 2 Aligned, WCAG 2.2 AA, GDPR Ready, IEP-Aware) + Footer "Designed to support COPPA & FERPA"
- **Internal links:** All 5 audience routes, 3 feature routes, /pricing, /demo

### `/for-parents`
- **Goal:** Parent signup or waitlist
- **Primary CTA:** Start Parent Setup (signup)
- **Secondary CTA:** Join the Waitlist
- **Objections addressed:** "Will it adapt to my child?", "Is data safe?", "Can I read the progress?"
- **Trust proof:** Parent controls section, /trust link

### `/for-schools`
- **Goal:** Demo request
- **Primary CTA:** Request a Demo
- **Secondary CTA:** Contact sales
- **Objections addressed:** Teacher load, classroom visibility, deployment, privacy
- **Trust proof:** /security link, /subprocessors link, FERPA-aware language

### `/for-districts`
- **Goal:** Demo + procurement packet
- **Primary CTA:** Request a Demo
- **Secondary CTA:** Download school packet (compliance@aivolearning.com)
- **Objections addressed:** Rostering, DPA, subprocessor list, scale
- **Trust proof:** /security, /subprocessors, /trust

### `/for-teachers`
- **Goal:** Demo / teacher trial
- **Primary CTA:** Request a Demo
- **Secondary CTA:** See LessonRun (feature page)

### `/for-special-education`
- **Goal:** Special-ed coordinator demo
- **Primary CTA:** Request a Demo
- **Secondary CTA:** Read /trust
- **Copy boundaries:** No diagnostic claims, no clinical overreach, no raw IEP text in mockups

### `/features/todays-mission`, `/features/lessonrun`, `/features/homework-helper`
- **Goal:** Move audience-page visitors deeper into product proof
- **Primary CTA:** Start free / Request demo (mode depends on referrer)

### `/pricing`
- **Goal:** Parent self-serve OR school/district demo
- **Primary CTA (family):** Start free
- **Primary CTA (school/district):** Request a quote

### `/demo`, `/waitlist`, `/contact`
- **Goal:** Lead capture (form completion)
- **Forms:** validate, success/error states, honeypot, dedup → `/api/contact` → console (dev) / admin-svc (prod)
- **Post-submit:** redirect to `/thank-you`

### `/security`, `/trust`, `/subprocessors`, `/privacy-policy`, `/coppa-compliance`, `/ferpa-compliance`, `/accessibility`, `/terms-of-service`, `/cookie-policy`
- **Goal:** Procurement / compliance review
- **Primary CTA:** compliance@aivolearning.com / security@aivolearning.com
- **Copy rule:** "Designed to support" language only — no certification claims

### `/blog`, `/resources`, `/blog/[slug]`, `/guides/[slug]`
- **Goal:** SEO + audience nurture
- **Primary CTA per article:** "Start a free account" / "Request a demo"

## Conversion proof points
Every audience page must include at least one of:
- Product mockup (Today's Mission, LessonRun, Parent summary, Teacher dashboard)
- Trust strip / compliance card with /security or /trust link
- Plain-language FAQ that answers top objections

## Dead-button policy
Every CTA in marketing must route to an existing page or an existing form. The PR-blocking marker check (`scripts/marketing-markers.sh`) plus `scripts/verify-marketing-build.sh` guard the homepage and compliance pages from regression.
