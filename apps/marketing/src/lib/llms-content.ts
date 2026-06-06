/**
 * Source of truth for the `/llms.txt` and `/llms-full.txt` agent manifests.
 *
 * These files make AIVO legible and quotable to generative engines. The link
 * set is sourced from the SAME data modules the sitemap uses (AUDIENCES,
 * LEVELS, SUBJECTS, COMPARISONS, TUTORS) so the manifests never drift from the
 * pages that actually exist — see the drift-guard test in
 * `lib/__tests__/llms-content.test.ts`.
 *
 * Spec reference: https://llmstxt.org — H1 site name, a short summary, then
 * sectioned markdown links to canonical URLs.
 */
import { SITE_URL } from "@/lib/constants";
import { AUDIENCES, LEVELS, SUBJECTS, COMPARISONS } from "@/lib/landing-content";
import { TUTORS } from "@/components/marketing/data";

/** Section headers, in order. Exported so CI (Sprint 3) can assert presence. */
export const LLMS_SECTION_HEADERS = [
  "## Products",
  "## For audiences",
  "## Pricing & trials",
  "## Compliance",
  "## Guides",
] as const;

const SITE_NAME = "AIVO Learning";

const SUMMARY =
  "AIVO Learning is an AI-powered adaptive learning platform for children of all abilities, " +
  "including learners with autism, ADHD, dyslexia, and IEPs. Each learner gets a personalized " +
  '"Brain Clone" plus a team of 14 specialized AI tutors across five functioning levels, from ' +
  "grade-level academics to AAC-assisted communication. AIVO is designed to support COPPA and " +
  "FERPA workflows for families, schools, and districts.";

type Link = { label: string; href: string; desc?: string };
type Section = { heading: (typeof LLMS_SECTION_HEADERS)[number]; links: Link[] };

/** Resolve a site-relative path to an absolute canonical URL. */
function abs(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

/**
 * Build the full sectioned link set. Per-slug links are generated from the
 * data modules so adding an audience / level / subject / tutor / comparison
 * automatically flows into the manifests (and the drift guard enforces it).
 */
export function buildSections(): Section[] {
  return [
    {
      heading: "## Products",
      links: [
        { label: "AI tutors", href: "/tutors", desc: "Meet the 14 specialized AI tutors" },
        ...TUTORS.map((t) => ({
          label: `${t.name} — ${t.domain}`,
          href: `/tutors/${t.name.toLowerCase()}`,
          desc: t.tagline,
        })),
        { label: "Functioning levels", href: "/levels", desc: "The five functioning levels" },
        ...LEVELS.map((l) => ({
          label: `Level ${l.level}: ${l.name}`,
          href: `/levels/${l.slug}`,
          desc: l.short,
        })),
        { label: "Subjects", href: "/subjects", desc: "Every subject AIVO tutors" },
        ...SUBJECTS.map((s) => ({
          label: `${s.name} (${s.tutorName})`,
          href: `/subjects/${s.slug}`,
          desc: s.short,
        })),
        { label: "Today's Mission", href: "/features/todays-mission" },
        { label: "LessonRun", href: "/features/lessonrun" },
        { label: "Homework Helper", href: "/features/homework-helper" },
      ],
    },
    {
      heading: "## For audiences",
      links: AUDIENCES.map((a) => ({
        label: a.badge,
        href: `/${a.slug}`,
        desc: a.metaDescription,
      })),
    },
    {
      heading: "## Pricing & trials",
      links: [
        { label: "Pricing", href: "/pricing", desc: "Plans for families, schools, and districts" },
        { label: "Request a demo", href: "/demo" },
        { label: "Join the waitlist", href: "/waitlist" },
      ],
    },
    {
      heading: "## Compliance",
      links: [
        { label: "COPPA posture", href: "/coppa-compliance" },
        { label: "FERPA posture", href: "/ferpa-compliance" },
        { label: "Security", href: "/security" },
        { label: "Trust center", href: "/trust" },
        { label: "Privacy policy", href: "/privacy-policy" },
        { label: "Subprocessors", href: "/subprocessors" },
        { label: "Accessibility", href: "/accessibility" },
      ],
    },
    {
      heading: "## Guides",
      links: [
        { label: "Guides", href: "/guides" },
        {
          label: "What schools should ask before buying AI learning tools",
          href: "/guides/school-buying-checklist-ai-learning",
        },
        {
          label: "How AIVO thinks about privacy and learner data",
          href: "/guides/how-aivo-thinks-about-privacy",
        },
        { label: "Blog", href: "/blog" },
        { label: "What is personalized learning?", href: "/blog/what-is-personalized-learning" },
        {
          label: "Understanding progress without jargon",
          href: "/blog/parent-progress-without-jargon",
        },
        { label: "What is a baseline assessment?", href: "/blog/what-is-a-baseline-assessment" },
        {
          label: "How read-aloud and scaffolds support learners",
          href: "/blog/read-aloud-and-scaffolds",
        },
        // Competitor comparisons (sourced from COMPARISONS so they never drift).
        ...COMPARISONS.map((c) => ({
          label: `AIVO vs ${c.competitor}`,
          href: `/compare/${c.slug}`,
        })),
      ],
    },
  ];
}

function renderLink({ label, href, desc }: Link): string {
  const line = `- [${label}](${abs(href)})`;
  return desc ? `${line}: ${desc}` : line;
}

function renderSections(): string {
  return buildSections()
    .map((s) => `${s.heading}\n\n${s.links.map(renderLink).join("\n")}`)
    .join("\n\n");
}

/** Spec-style `/llms.txt`: H1, summary, then sectioned canonical links. */
export function renderLlmsTxt(): string {
  return `# ${SITE_NAME}

> ${SUMMARY}

${renderSections()}
`;
}

/**
 * Extended value-prop facts inlined at the top of `/llms-full.txt`. Kept
 * factual and quotable (no marketing fluff) — this is the body LLMs cite.
 */
const VALUE_PROP = `## What AIVO is

AIVO Learning is an AI-powered adaptive learning platform for children ages 3–18 (Pre-K through high school), including learners on IEPs and those with autism, ADHD, dyslexia, or complex sensory and communication needs. It is designed to replace several single-purpose apps (a tutor, a reading app, a speech app) with one personalized platform.

## Brain Clone

Every learner gets a personalized "Brain Clone": a model of how that learner learns, composed from a parent assessment, optional IEP/accommodation context, a baseline assessment, and a running mastery history. The Brain Clone tunes pacing, scaffolds, examples, and the next action for each learner, and it evolves as the learner progresses.

## 14 AI tutors

AIVO ships 14 specialized AI tutors, each with a distinct domain and personality — for example Nova (math), Sage (reading & ELA), and Echo (speech / AAC). Tutors adapt difficulty in real time and are available on demand, without separate logins per subject.

## Five functioning levels

Content is delivered across five functioning levels so learners of any ability find an appropriate path:
- Level 1 (Standard): grade-level academics with adaptive pacing.
- Level 2 (Supported): modified curriculum with scaffolding and visual supports.
- Level 3, 4, 5: increasing support through self-contained, life-skills, and pre-symbolic / AAC-assisted communication, with switch access and eye-gaze support.

## Privacy & compliance posture

AIVO is designed to support COPPA and FERPA workflows. AIVO does not use learner data — chats, Brain-Clone state, or assessment results — to train any third-party foundation model, and does not sell or rent learner or family data or show third-party ads on learner surfaces. For learners under 13, parents are the default authority. Account deletion is permanent within 30 days of request. AIVO publishes a subprocessor list and describes its live posture on the /security and /trust pages; it does not claim certifications it has not earned.

## Pricing & trials

AIVO offers a free parent plan to start, plus paid family plans and school/district plans (including a multi-learner discount for families with two or more children). Paid plans carry a 30-day money-back guarantee. A free trial is available with no credit card required; trials convert to paid only if the family or school chooses to continue. See /pricing for current plans.`;

/**
 * `/llms-full.txt`: the same canonical link set plus the inlined, quotable
 * value-prop copy LLMs are most likely to cite.
 */
export function renderLlmsFullTxt(): string {
  return `# ${SITE_NAME}

> ${SUMMARY}

${VALUE_PROP}

${renderSections()}
`;
}
