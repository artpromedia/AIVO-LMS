/**
 * Parent Resources library — curated, source-cited educational content.
 *
 * Mirrors the marketing guides content shape (`apps/marketing/src/lib/content`)
 * so the editorial pipeline stays consistent, but lives in web-v2 as data (not
 * JSX) so it is never flagged by the hardcoded-English gate and the resources
 * pages keep their chrome in i18n.
 *
 * Editorial rules baked into the model:
 *  - Every resource carries ≥1 `source` (claims are attributed, not invented).
 *  - Content is educational, never medical/clinical advice — the UI renders a
 *    standing disclaimer and points families back to their care team.
 */

export type ResourceCategory =
  | "getting_started"
  | "learning_at_home"
  | "accessibility"
  | "advocacy"
  | "wellbeing";

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  "getting_started",
  "learning_at_home",
  "accessibility",
  "advocacy",
  "wellbeing",
];

export type ResourceBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type ResourceSource = {
  label: string;
  publisher: string;
  url: string;
};

export type ParentResource = {
  slug: string;
  category: ResourceCategory;
  title: string;
  summary: string;
  readMinutes: number;
  updatedAt: string; // ISO date
  tags: string[];
  body: ResourceBlock[];
  sources: ResourceSource[];
};

const RESOURCES: ParentResource[] = [
  {
    slug: "understanding-your-childs-learning-profile",
    category: "getting_started",
    title: "Understanding your child's learning profile",
    summary:
      "What a learning profile captures, why strengths matter as much as challenges, and how AIVO uses it to personalize lessons.",
    readMinutes: 5,
    updatedAt: "2026-05-20",
    tags: ["profile", "strengths", "baseline", "neurodiversity"],
    body: [
      {
        type: "p",
        text: "A learning profile is a picture of how your child learns best — the strengths they lean on, the supports that help, and the areas they are still building. It is not a label or a diagnosis. AIVO builds the profile from your input, an optional baseline, and what we observe as your child learns, then uses it to adjust the difficulty, pacing, and presentation of each lesson.",
      },
      { type: "h2", text: "Strengths are part of the picture" },
      {
        type: "p",
        text: "Many learning frameworks emphasize that every learner has a mix of strengths and stretch areas, and that teaching to strengths builds confidence and motivation. Understood.org's library on learning and thinking differences is a helpful, plain-language starting point for families.",
      },
      { type: "h2", text: "What you can do" },
      {
        type: "ul",
        items: [
          "Add what you already know — interests, what calms your child, what frustrates them — on the learner's profile.",
          "Invite a teacher, therapist, caregiver, or coach to contribute their perspective from the Care team page.",
          "Review the What's Working panel after a few sessions to see real patterns.",
        ],
      },
    ],
    sources: [
      {
        label: "Learning and thinking differences — an overview for families",
        publisher: "Understood.org",
        url: "https://www.understood.org/en/articles/understanding-learning-and-thinking-differences",
      },
      {
        label: "Developmental milestones",
        publisher: "Centers for Disease Control and Prevention",
        url: "https://www.cdc.gov/ncbddd/actearly/milestones/index.html",
      },
    ],
  },
  {
    slug: "sensory-friendly-homework-space",
    category: "learning_at_home",
    title: "Setting up a sensory-friendly learning space",
    summary:
      "Small, low-cost changes to light, sound, and seating that can make focused learning easier at home.",
    readMinutes: 4,
    updatedAt: "2026-05-12",
    tags: ["sensory", "environment", "focus", "home"],
    body: [
      {
        type: "p",
        text: "The space around a learner shapes how easily they can focus. There is no single 'right' setup — the goal is to reduce the sensory load that competes for your child's attention and to let them adjust what they can control.",
      },
      { type: "h2", text: "Things families often try" },
      {
        type: "ul",
        items: [
          "Reduce visual clutter in the line of sight; keep only what the current task needs.",
          "Offer noise-reducing headphones or quiet background sound for learners who are sound-sensitive.",
          "Provide a choice of seating (a cushion, a standing option) so the learner can self-regulate.",
          "Use consistent, comfortable lighting and avoid flicker where you can.",
        ],
      },
      {
        type: "p",
        text: "AIVO's accessibility settings — reduced motion, high contrast, larger text, audio-first, and calm audio cues — complement the physical space. You can set defaults per learner from their Accessibility page.",
      },
    ],
    sources: [
      {
        label: "Universal Design for Learning guidelines (engagement & perception)",
        publisher: "CAST",
        url: "https://udlguidelines.cast.org/",
      },
    ],
  },
  {
    slug: "what-wcag-aa-means-for-your-learner",
    category: "accessibility",
    title: "What 'WCAG AA' means for your learner",
    summary:
      "A plain-language explainer of the accessibility standard AIVO is built to, and the settings you can turn on.",
    readMinutes: 4,
    updatedAt: "2026-04-30",
    tags: ["accessibility", "wcag", "contrast", "captions"],
    body: [
      {
        type: "p",
        text: "WCAG (the Web Content Accessibility Guidelines) is the international standard for making digital content usable by people with disabilities. 'AA' is the conformance level most products and public agencies aim for. AIVO designs its learner and parent surfaces to meet WCAG 2.2 AA.",
      },
      { type: "h2", text: "What AA covers, in practice" },
      {
        type: "ul",
        items: [
          "Text and meaningful images have enough contrast to be read comfortably.",
          "Everything works with a keyboard — no action requires a mouse.",
          "Content is structured so screen readers can announce it in order.",
          "Motion can be reduced for learners who are sensitive to it.",
        ],
      },
      {
        type: "p",
        text: "These are floor requirements, not the ceiling. On each learner's Accessibility page you can go further — dyslexia-friendly fonts, captions always on, read-aloud, and AAC input methods including switch scanning.",
      },
    ],
    sources: [
      {
        label: "Web Content Accessibility Guidelines (WCAG) 2.2",
        publisher: "W3C",
        url: "https://www.w3.org/TR/WCAG22/",
      },
    ],
  },
  {
    slug: "preparing-for-an-iep-meeting",
    category: "advocacy",
    title: "Preparing for an IEP meeting",
    summary:
      "What an IEP is, the rights it protects, and how to walk in prepared with evidence from your learner's progress.",
    readMinutes: 6,
    updatedAt: "2026-05-02",
    tags: ["iep", "advocacy", "school", "rights"],
    body: [
      {
        type: "p",
        text: "In the United States, an Individualized Education Program (IEP) is a written plan for a student who qualifies for special education under IDEA, the Individuals with Disabilities Education Act. It describes the supports and goals the school will provide. As a parent or guardian, you are a full member of the IEP team.",
      },
      { type: "h2", text: "Walk in prepared" },
      {
        type: "ul",
        items: [
          "Bring concrete examples of what helps your child and where they struggle.",
          "Use the What's Working panel and Progress page to bring real patterns — best learning windows, modalities that click, where frustration spikes.",
          "Ask how each proposed goal will be measured and how often you'll get updates.",
          "Know that you can ask questions, disagree, and request changes.",
        ],
      },
      {
        type: "p",
        text: "If your child's care team uses AIVO, the IEP page and the contributor flow let teachers and therapists submit observations that feed the same picture you see.",
      },
    ],
    sources: [
      {
        label: "About IDEA — Individuals with Disabilities Education Act",
        publisher: "U.S. Department of Education",
        url: "https://sites.ed.gov/idea/about-idea/",
      },
      {
        label: "The IEP — a guide for families",
        publisher: "Understood.org",
        url: "https://www.understood.org/en/articles/the-iep-meeting-an-overview",
      },
    ],
  },
  {
    slug: "supporting-executive-function-at-home",
    category: "learning_at_home",
    title: "Supporting executive function at home",
    summary:
      "Practical ways to scaffold planning, working memory, and self-control during everyday learning.",
    readMinutes: 5,
    updatedAt: "2026-05-18",
    tags: ["executive function", "routines", "working memory", "home"],
    body: [
      {
        type: "p",
        text: "Executive function is the set of mental skills we use to plan, hold information in mind, and manage impulses. Researchers at the Harvard Center on the Developing Child describe these skills as the brain's 'air traffic control' — and, importantly, as skills that develop over time and can be supported by the environment.",
      },
      { type: "h2", text: "Scaffolds that help" },
      {
        type: "ul",
        items: [
          "Break tasks into small, visible steps and celebrate finishing each one.",
          "Use predictable routines so less attention is spent on 'what's next'.",
          "Offer brief, planned breaks before frustration builds.",
          "Externalize memory — checklists, timers, and visual schedules.",
        ],
      },
      {
        type: "p",
        text: "AIVO's shorter-steps, extra-hints, and break-reminder settings build several of these scaffolds directly into lessons. Turn them on per learner from the Accessibility page.",
      },
    ],
    sources: [
      {
        label: "Executive Function & Self-Regulation",
        publisher: "Harvard Center on the Developing Child",
        url: "https://developingchild.harvard.edu/science/key-concepts/executive-function/",
      },
    ],
  },
  {
    slug: "screen-time-and-focus-a-balanced-view",
    category: "wellbeing",
    title: "Screen time and focus: a balanced view",
    summary:
      "How to think about screens for learning, with guidance from pediatric recommendations.",
    readMinutes: 4,
    updatedAt: "2026-04-22",
    tags: ["wellbeing", "screen time", "balance", "sleep"],
    body: [
      {
        type: "p",
        text: "Not all screen time is the same. The American Academy of Pediatrics encourages families to focus on the quality and context of media — what your child is doing, with whom, and when — rather than a single magic number of minutes. Interactive, goal-directed learning is different from passive scrolling.",
      },
      { type: "h2", text: "A family media plan" },
      {
        type: "ul",
        items: [
          "Keep screens out of the bedroom around sleep, and protect a wind-down routine.",
          "Prefer active, creative, or learning-focused use over passive consumption.",
          "Take regular breaks — AIVO can prompt them automatically.",
          "Model the balance you want to see; do it together when you can.",
        ],
      },
      {
        type: "p",
        text: "This is general guidance, not a prescription. Every child is different — your pediatrician and care team know yours best.",
      },
    ],
    sources: [
      {
        label: "Family Media Plan and media use guidance",
        publisher: "American Academy of Pediatrics (HealthyChildren.org)",
        url: "https://www.healthychildren.org/English/family-life/Media/Pages/default.aspx",
      },
    ],
  },
];

/** All resources, newest update first. */
export function listResources(): ParentResource[] {
  return [...RESOURCES].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getResource(slug: string): ParentResource | null {
  return RESOURCES.find((r) => r.slug === slug) ?? null;
}

/** Plain-text haystack for a resource (title + summary + tags + body text). */
function haystack(r: ParentResource): string {
  const bodyText = r.body
    .map((b) => (b.type === "ul" ? b.items.join(" ") : b.text))
    .join(" ");
  return `${r.title} ${r.summary} ${r.tags.join(" ")} ${bodyText}`.toLowerCase();
}

/**
 * Filter by free-text query (case-insensitive, all terms must match) and an
 * optional category. Pure + deterministic for tests.
 */
export function searchResources(
  resources: ParentResource[],
  query: string,
  category?: ResourceCategory | "all",
): ParentResource[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return resources.filter((r) => {
    if (category && category !== "all" && r.category !== category) return false;
    if (terms.length === 0) return true;
    const hay = haystack(r);
    return terms.every((term) => hay.includes(term));
  });
}
