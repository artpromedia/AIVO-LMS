export type ContentKind = "blog" | "guide";

export type ContentArticle = {
  slug: string;
  kind: ContentKind;
  category: string;
  categoryColor: string;
  title: string;
  excerpt: string;
  readTime: string;
  publishedAt: string;
  author: string;
  body: Array<
    | { type: "p"; text: string }
    | { type: "h2"; text: string }
    | { type: "ul"; items: string[] }
  >;
};

export const CONTENT: ContentArticle[] = [
  {
    slug: "what-is-personalized-learning",
    kind: "blog",
    category: "Personalized Learning",
    categoryColor: "#7c3aed",
    title: "What Is Personalized Learning?",
    excerpt:
      "Personalized learning means the path adapts to the learner — pacing, support, examples, and next steps. Here is what that means in practice, in plain language.",
    readTime: "5 min read",
    publishedAt: "2026-05-10",
    author: "AIVO Learning",
    body: [
      { type: "p", text: "Personalized learning is the idea that each learner is met where they are. Instead of marching the entire classroom through identical pages, the lesson responds to the learner: it slows down on the rough patches, accelerates on the strong ones, and offers the kind of support that learner actually uses." },
      { type: "h2", text: "What changes for the learner" },
      { type: "ul", items: [
        "Step length adapts to attention span and prior mastery.",
        "Hints arrive before frustration — not after.",
        "Read-aloud, scaffolds, and visual supports are offered automatically when the learner profile says they help.",
        "Today's Mission gives a single clear next action instead of a wall of choices.",
      ]},
      { type: "h2", text: "What stays the same" },
      { type: "p", text: "The curriculum and standards do not change. The destination is the same. What changes is the route — and how much the learner enjoys the trip." },
      { type: "h2", text: "What AIVO does specifically" },
      { type: "p", text: "AIVO combines a parent assessment, an optional IEP or accommodation context, a baseline assessment, and a mastery history to compose each LessonRun. The system never asks a learner to stare at a dashboard of options. It always gives one next action." },
    ],
  },
  {
    slug: "parent-progress-without-jargon",
    kind: "blog",
    category: "Parent Guides",
    categoryColor: "#059669",
    title: "How Parents Can Understand Learning Progress Without Jargon",
    excerpt:
      "Progress should be readable. A short guide to what AIVO's parent summaries actually mean — and which terms you can safely ignore.",
    readTime: "4 min read",
    publishedAt: "2026-05-03",
    author: "AIVO Learning",
    body: [
      { type: "p", text: "School language can feel like a foreign country. AIVO is built so that parents do not need to learn the jargon to understand whether learning is going well." },
      { type: "h2", text: "What the parent summary actually tells you" },
      { type: "ul", items: [
        "What your child worked on this week, in plain words.",
        "Where things clicked — and where they slowed down.",
        "What AIVO will try next, and why.",
        "Anything you might want to talk to a teacher about (only when it actually matters).",
      ]},
      { type: "h2", text: "Terms you do not need to memorize" },
      { type: "p", text: "Mastery score, standards alignment, scaffold tier — these are useful to teachers, but the parent summary translates them. If you ever want the underlying detail, every plain-language sentence links to the full data." },
      { type: "h2", text: "The two questions worth asking" },
      { type: "p", text: "If you only ever ask two questions, ask: \"What did my child enjoy this week?\" and \"What got harder this week?\" The first protects motivation. The second catches problems before they become invisible." },
    ],
  },
  {
    slug: "what-is-a-baseline-assessment",
    kind: "blog",
    category: "Assessments",
    categoryColor: "#2563eb",
    title: "What Is a Baseline Assessment?",
    excerpt:
      "Not a test. Not a grade. A short, adaptive starting point so the lesson plan begins at the right place, not too easy and not too hard.",
    readTime: "5 min read",
    publishedAt: "2026-04-26",
    author: "AIVO Learning",
    body: [
      { type: "p", text: "A baseline assessment is the very first conversation AIVO has with a learner. It is short, adaptive, and gentle — not a quiz, not a grade, and not something the learner can fail." },
      { type: "h2", text: "Why we do it" },
      { type: "p", text: "Without a baseline, every adaptive system is guessing. The first lessons would either bore strong learners or overwhelm struggling ones. The baseline tells the system where to start so the first real LessonRun lands at the right height." },
      { type: "h2", text: "What it looks like for the learner" },
      { type: "ul", items: [
        "Six short chapters framed as a Discovery Adventure.",
        "Difficulty adapts up and down — no one sees the same items.",
        "Built-in break activities so the experience never feels like a test.",
        "No score is shown to the learner. The result feeds the plan, not the ego.",
      ]},
      { type: "h2", text: "What parents see" },
      { type: "p", text: "Parents get a plain-language readout: what AIVO learned, where to start, and what to watch over the first two weeks." },
    ],
  },
  {
    slug: "read-aloud-and-scaffolds",
    kind: "blog",
    category: "Accessibility",
    categoryColor: "#d97706",
    title: "How Read-Aloud and Scaffolds Support Learners",
    excerpt:
      "Support is not a shortcut. A short look at when AIVO offers read-aloud, hints, examples, and reduced cognitive load — and when it pulls back.",
    readTime: "6 min read",
    publishedAt: "2026-04-19",
    author: "AIVO Learning",
    body: [
      { type: "p", text: "Good support disappears when it stops being needed. AIVO offers four support modes — read-aloud, hints, scaffolded examples, and reduced cognitive load — and the right one shows up at the right time, then steps back as the learner gains confidence." },
      { type: "h2", text: "Read-aloud" },
      { type: "p", text: "Available on every lesson surface. Honors the learner's speed, voice, and pause preferences. Reading support is a learning aid, not a reading-skill substitute — AIVO continues to build decoding skill in parallel." },
      { type: "h2", text: "Hints" },
      { type: "p", text: "Hints arrive when the system detects struggle, not as a shortcut button to skip the work. The hint always points toward the strategy the learner just learned, not the answer." },
      { type: "h2", text: "Scaffolded examples" },
      { type: "p", text: "When a step is too tall, AIVO breaks it into smaller stairs. The learner solves each smaller piece, then the full step is offered again." },
      { type: "h2", text: "Reduced cognitive load" },
      { type: "p", text: "Some learners do better with fewer items on screen, less animation, and shorter instructions. AIVO can apply all three automatically when the parent or IEP context says they help." },
    ],
  },
  {
    slug: "school-buying-checklist-ai-learning",
    kind: "guide",
    category: "School Implementation",
    categoryColor: "#0891b2",
    title: "What Schools Should Ask Before Buying AI Learning Tools",
    excerpt:
      "A procurement-friendly checklist: data boundaries, learner privacy, teacher workflow fit, accessibility, and what \"AI-powered\" actually has to mean.",
    readTime: "8 min read",
    publishedAt: "2026-04-12",
    author: "AIVO Learning",
    body: [
      { type: "p", text: "AI learning tools are arriving faster than procurement teams can review them. This guide is a short, vendor-neutral checklist to use when an AI learning product lands on your desk — including this one." },
      { type: "h2", text: "Learner data" },
      { type: "ul", items: [
        "Where is learner data stored, and who has access?",
        "Is learner content used to train any third-party foundation model? It should not be.",
        "Can the district export and delete on request? How long does deletion actually take?",
        "Is there a published subprocessor list?",
      ]},
      { type: "h2", text: "Teacher workflow" },
      { type: "ul", items: [
        "Does the tool reduce or add to teacher load?",
        "Does the teacher view show class-level signal, not raw learner chats?",
        "Can the teacher override or pause individual recommendations?",
      ]},
      { type: "h2", text: "Accessibility" },
      { type: "ul", items: [
        "WCAG 2.2 AA design target.",
        "Read-aloud on every learner surface.",
        "Keyboard navigation across the full app.",
        "Reduced-motion and high-contrast modes.",
      ]},
      { type: "h2", text: "Honesty" },
      { type: "p", text: "Ask the vendor what their product cannot do. A vendor who answers cleanly is more trustworthy than one who claims everything works." },
    ],
  },
  {
    slug: "how-aivo-thinks-about-privacy",
    kind: "guide",
    category: "Privacy & Safety",
    categoryColor: "#7c3aed",
    title: "How AIVO Thinks About Privacy and Learner Data",
    excerpt:
      "A short, plain version of the privacy posture: no learner data to foundation-model training, parent-default authority under 13, deletion within 30 days.",
    readTime: "6 min read",
    publishedAt: "2026-04-05",
    author: "AIVO Learning",
    body: [
      { type: "p", text: "The /privacy and /trust pages cover the full posture. This guide is the short version, written for a parent or principal who has ten minutes." },
      { type: "h2", text: "The three commitments" },
      { type: "ul", items: [
        "We do not use learner data — chats, Brain-Clone state, assessment results — to train any third-party foundation model.",
        "We do not sell or rent learner or family data.",
        "We do not show third-party advertisements on learner surfaces.",
      ]},
      { type: "h2", text: "Parent authority" },
      { type: "p", text: "For learners under 13, parents are the default authority. Where a school is acting as the responsible party under FERPA, parents retain inspection rights through their school." },
      { type: "h2", text: "Data export and deletion" },
      { type: "p", text: "Parents can request a full export at privacy@aivolearning.com. Account deletion is permanent within 30 days of request." },
      { type: "h2", text: "What we are designed to support" },
      { type: "p", text: "AIVO is designed to support COPPA and FERPA. We do not claim compliance certification we have not earned — see /security and /subprocessors for the live posture." },
    ],
  },
];

export function getArticle(slug: string, kind?: ContentKind): ContentArticle | undefined {
  return CONTENT.find((a) => a.slug === slug && (kind === undefined || a.kind === kind));
}

export function getArticlesByKind(kind: ContentKind): ContentArticle[] {
  return CONTENT.filter((a) => a.kind === kind);
}

export function getAllArticles(): ContentArticle[] {
  return CONTENT;
}
