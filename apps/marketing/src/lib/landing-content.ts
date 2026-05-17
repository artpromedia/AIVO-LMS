/**
 * Static content for audience landing pages, tutor / level / subject hubs,
 * and competitor comparison pages. Kept in plain TS (not i18n keys) so each
 * page can be a pure RSC and ship as static HTML for SEO.
 */

export type Audience = {
  slug: string;
  badge: string;
  badgeColor: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  subtitle: string;
  benefits: { title: string; desc: string }[];
  outcomes: string[];
  faqs: { q: string; a: string }[];
};

export const AUDIENCES: Audience[] = [
  {
    slug: "for-parents",
    badge: "For Parents",
    badgeColor: "#7c3aed",
    title: "An AI tutor that finally meets your child where they are",
    metaTitle: "AIVO for Parents – Personalized AI Tutoring for Every Child",
    metaDescription:
      "AIVO gives every child their own team of AI tutors that adapt in real-time. Built for families with kids on IEPs, with autism, ADHD, dyslexia, or any learning style. Designed for COPPA-aware workflows and FERPA-aware data handling.",
    subtitle:
      "Whether your child is gifted, on an IEP, or somewhere in between, AIVO builds a personalized Brain Clone that learns how they learn — and grows with them across every subject.",
    benefits: [
      {
        title: "One platform, every learning style",
        desc: "AIVO supports five functioning levels — from grade-level academics to AAC-assisted communication — so every child in your family gets a path that fits.",
      },
      {
        title: "14 AI tutors, on call 24/7",
        desc: "Math, reading, writing, science, languages, social-emotional skills and more — each tutor has a unique personality and adapts difficulty in real time.",
      },
      {
        title: "Real-time progress dashboard",
        desc: "See exactly what your child is mastering, where they are stuck, and how their Brain Clone is evolving — without waiting for a parent-teacher conference.",
      },
      {
        title: "Built safe for kids",
        desc: "Designed for COPPA-aware workflows. No ads. No data sales. Conversations are sandboxed and reviewed for age-appropriate language by design.",
      },
    ],
    outcomes: [
      "Replace 3+ apps (tutor + reading app + speech app) with one personalized platform",
      "IEP goals tracked and reinforced automatically across every tutor session",
      "Sensory-friendly visuals and audio that respect your child's preferences",
      "Multi-learner discount for families with two or more children",
    ],
    faqs: [
      {
        q: "Can my child use AIVO on a Chromebook or iPad?",
        a: "Yes. AIVO works on any modern browser and is optimized for Chromebooks, iPads, and laptops. It also works seamlessly with AAC devices, switch access, and eye-gaze technology.",
      },
      {
        q: "How is this different from Khan Academy or IXL?",
        a: "Khan Academy is free general curriculum. IXL is grade-level skill drills. AIVO is a personalized AI tutor team that adapts to your child's specific learning profile — including IEP accommodations and sensory needs — across every subject in one place.",
      },
      {
        q: "What ages do you support?",
        a: "Pre-K through high school, ages 3–18. Our five functioning levels mean children of any ability can find content that's appropriately challenging and engaging.",
      },
      {
        q: "What if my child doesn't connect with it?",
        a: "We offer a 30-day money-back guarantee on every paid plan. If your family isn't seeing progress, we'll refund every cent — no questions asked.",
      },
    ],
  },
  {
    slug: "for-teachers",
    badge: "For Teachers",
    badgeColor: "#0891b2",
    title: "Differentiated instruction, finally automated",
    metaTitle: "AIVO for Teachers – AI-Powered Differentiation for Every Classroom",
    metaDescription:
      "Spend less time prepping differentiated materials and more time teaching. AIVO assigns work, tracks mastery, and writes IEP-aligned progress notes for every student — including those at every functioning level.",
    subtitle:
      "AIVO's Brain Clone runs differentiation for you. Assign one lesson; every student gets a version tuned to their level, accommodations, and pacing — with progress data ready for your IEP and RTI meetings.",
    benefits: [
      {
        title: "One assignment, every level",
        desc: "Push a single lesson to your roster; AIVO automatically delivers it at each student's functioning level with the right scaffolds, sensory profile, and accommodations.",
      },
      {
        title: "IEP-aligned data, automatically",
        desc: "Progress monitoring, goal mastery, and quarterly reports auto-populate from real session data — saving 10+ hours per student per quarter.",
      },
      {
        title: "Co-teach with 14 AI tutors",
        desc: "Use Sage for ELA centers, Nova for math intervention, Echo for AAC speech goals, Harmony for SEL check-ins — without juggling 14 logins.",
      },
      {
        title: "Live mastery dashboards",
        desc: "Spot the kid who needs you in 30 seconds. Heat-mapped class views show who's stuck, who's flying, and who needs a different approach.",
      },
    ],
    outcomes: [
      "Cut differentiated lesson prep from hours to minutes",
      "Ready-to-paste IEP progress notes drawn from real session data",
      "Center rotations that actually adapt — no more 'finish early' busywork",
      "Caseload-friendly: built with SPED teachers and SLPs from day one",
    ],
    faqs: [
      {
        q: "Does AIVO replace my curriculum?",
        a: "No. AIVO complements your core curriculum. It handles differentiation, practice, and progress monitoring while you drive instruction and Tier 1 teaching.",
      },
      {
        q: "Will this work for my self-contained class?",
        a: "Yes. Levels 3–5 were designed specifically for self-contained, life-skills, and pre-symbolic learners with AAC, switch access, and eye-gaze support built in.",
      },
      {
        q: "How does AIVO handle student data privacy?",
        a: "AIVO is designed for FERPA-aware data handling and never sells or shares student data. Districts can sign DPAs and configure data retention to local policy. We publish a security packet and subprocessor list on request — we do not claim certifications we don't hold.",
      },
    ],
  },
  {
    slug: "for-schools",
    badge: "For Schools",
    badgeColor: "#0891b2",
    title: "Personalized learning across your whole building",
    metaTitle: "AIVO for Schools – AI Adaptive Learning for K-12 Buildings",
    metaDescription:
      "Bring AIVO to a single school with admin dashboards, MTSS-aligned reporting, IEP integration, and dedicated onboarding. COPPA, FERPA, SOC 2, WCAG 2.2 AA compliant.",
    subtitle:
      "Equip every classroom in your building with AI tutors that adapt to every learner — including those on IEPs and 504s — and give your admin team real-time mastery data they can actually act on.",
    benefits: [
      {
        title: "MTSS / RTI ready",
        desc: "Tier 1 enrichment, Tier 2 small-group practice, and Tier 3 intensive intervention — all delivered by the same Brain Clone, with progress monitoring built in.",
      },
      {
        title: "SPED-first design",
        desc: "Five functioning levels, AAC integration, sensory profiles, and IEP goal tracking are core features, not bolt-ons.",
      },
      {
        title: "Admin dashboards",
        desc: "Building-wide mastery, attendance, and engagement views — filterable by grade, classroom, IEP status, or English-learner status.",
      },
      {
        title: "Dedicated onboarding",
        desc: "Single sign-on (SSO) with Clever / ClassLink / Google, roster sync, and onsite or virtual PD for your staff.",
      },
    ],
    outcomes: [
      "Reduce time spent writing IEP progress notes by 60–80%",
      "Single sign-on via Clever, ClassLink, Google, or SAML",
      "FERPA-aware data sharing and DPAs available on request",
      "WCAG 2.2 AA accessibility audit on file",
    ],
    faqs: [
      {
        q: "Can we pilot before committing?",
        a: "Yes. We offer free 60-day school pilots that include onboarding, training, and a results review — so your team can evaluate impact before a district-wide commit.",
      },
      {
        q: "Do you integrate with our SIS?",
        a: "AIVO integrates with Clever, ClassLink, Google Workspace, and standards-based SIS rosters. Custom SAML SSO and SFTP roster syncs are available on Schools and Districts plans.",
      },
    ],
  },
  {
    slug: "for-districts",
    badge: "For Districts",
    badgeColor: "#1e40af",
    title: "Scalable, IEP-aware AI for every learner in your district",
    metaTitle: "AIVO for Districts – District-Wide AI Adaptive Learning Platform",
    metaDescription:
      "Volume pricing, dedicated success management, MTSS-aligned analytics, and SPED-first design. AIVO is the only AI learning platform built from the ground up for inclusive, district-wide deployment.",
    subtitle:
      "AIVO scales personalized learning across thousands of students without sacrificing the depth of accommodation each one deserves. Volume pricing, dedicated CSM, and tooling your SPED leadership has been waiting for.",
    benefits: [
      {
        title: "District-wide analytics",
        desc: "Slice mastery, growth, and engagement by school, grade, IEP status, EL status, free/reduced lunch, or any roster attribute — in real time.",
      },
      {
        title: "SPED leadership tools",
        desc: "Caseload dashboards, IEP goal libraries aligned to state standards, AAC/AT compatibility, and progress-monitoring reports your team can paste straight into IEPs.",
      },
      {
        title: "Procurement-friendly",
        desc: "Standard DPA, COPPA Safe Harbor seal, FERPA compliance, SOC 2 Type II report, WCAG 2.2 AA VPAT, and 1EdTech-style data export on file.",
      },
      {
        title: "Onboarding that respects your calendar",
        desc: "Roster sync, SSO, and PD that fit pre-service week. Dedicated CSM, quarterly business reviews, and a 24-hour SLA on critical issues.",
      },
    ],
    outcomes: [
      "Volume-tier pricing scales from 500 to 50,000+ students",
      "Pre-built integrations: Clever, ClassLink, Google, Microsoft, SAML",
      "Dedicated Customer Success Manager and a 24-hour critical-issue SLA",
      "Quarterly outcome reviews aligned to your strategic plan",
    ],
    faqs: [
      {
        q: "Do you have a DPA we can sign?",
        a: "Yes. We have standard SDPC-aligned DPAs, state-specific addendums (CA, IL, NY, TX, MA, CO and more), and we will sign your district's DPA.",
      },
      {
        q: "What does pricing look like at scale?",
        a: "District pricing starts in the low single-digit dollars per student per year and decreases with volume. We will provide a quote during your district scoping call.",
      },
      {
        q: "Can AIVO replace our existing intervention tools?",
        a: "Districts that adopt AIVO commonly retire 2–4 single-purpose tools (separate reading, math, speech, and SEL apps) and consolidate onto one Brain Clone per learner. We are happy to model the impact during procurement.",
      },
    ],
  },
  {
    slug: "for-special-education",
    badge: "Special Education",
    badgeColor: "#db2777",
    title: "AI built from the ground up for IEP and 504 learners",
    metaTitle: "AIVO for Special Education – IEP-Aware AI Tutoring & Progress Monitoring",
    metaDescription:
      "Five functioning levels, AAC and switch access, sensory profiles, and IEP goal tracking — all in one platform. AIVO is built for SPED teachers, SLPs, OTs, and the families they serve.",
    subtitle:
      "AIVO is the only AI learning platform that supports learners from grade-level academics down to pre-symbolic, cause-and-effect interaction — with AAC, switch access, eye-gaze, and IEP integration as first-class features.",
    benefits: [
      {
        title: "Five functioning levels",
        desc: "Standard, Supported, Guided, Exploratory, and Pre-Symbolic — each with curriculum, accommodations, and assessment tuned to the learner's profile.",
      },
      {
        title: "AAC, switch, and eye-gaze native",
        desc: "Compatible with TouchChat, Proloquo2Go, LAMP, Tobii, and switch interfaces. No clunky workarounds — AIVO speaks AAC.",
      },
      {
        title: "IEP goal libraries",
        desc: "State-aligned goal banks for math, ELA, communication, social-emotional, and life skills. Auto-populate progress notes from real session data.",
      },
      {
        title: "Sensory profiles",
        desc: "Adjust visuals, sound, animation, and pacing to match each learner's sensory thresholds — and pause, rewind, or change tutors any time.",
      },
    ],
    outcomes: [
      "Cut quarterly IEP-progress-note writing time by 60–80%",
      "AAC, switch, and eye-gaze access at every functioning level",
      "Sensory-friendly defaults for autistic learners",
      "Therapist, teacher, and parent collaboration in one shared learner profile",
    ],
    faqs: [
      {
        q: "Will this work for non-verbal learners?",
        a: "Yes. Levels 4 and 5 are designed for emerging communicators, including learners using AAC and pre-symbolic learners working on cause-and-effect, joint attention, and engagement.",
      },
      {
        q: "Can therapists collaborate inside AIVO?",
        a: "Yes. Parents control invitations. SLPs, OTs, BCBAs, and special-education teachers can be added to a learner's circle with role-appropriate access to data, goals, and notes.",
      },
      {
        q: "Is AIVO appropriate for adult learners with disabilities?",
        a: "While AIVO is currently optimized for ages 3–18, the platform's core design supports adult learners and we offer adapted deployments for transition-age and adult disability programs. Contact us to scope.",
      },
    ],
  },
  {
    slug: "for-homeschool",
    badge: "For Homeschool",
    badgeColor: "#d97706",
    title: "Your AI co-teacher for every subject, every learner",
    metaTitle: "AIVO for Homeschool – AI Tutors That Adapt to Every Child",
    metaDescription:
      "Homeschooling 1, 3, or 7 kids? AIVO gives each one a personalized AI tutor team across every subject — with progress dashboards, lesson plans, and standards alignment built in.",
    subtitle:
      "Whether you teach to a classical curriculum, unschool, or follow a state-aligned scope-and-sequence, AIVO becomes the patient co-teacher who handles practice, fluency, and mastery while you focus on the experiences that matter.",
    benefits: [
      {
        title: "Multi-learner Family plan",
        desc: "Up to 10 learners on one account at the lowest per-learner price — every child gets their own Brain Clone and tutor team.",
      },
      {
        title: "Standards-aligned, but flexible",
        desc: "Aligned to your state standards or Common Core if you want it; pure unschooling-friendly project mode if you don't.",
      },
      {
        title: "Frees up your day",
        desc: "Hand off math fluency drills, spelling, vocab, and reading practice to AIVO so your time goes to the rich conversations and field trips that only you can run.",
      },
      {
        title: "Reports for record-keeping",
        desc: "Auto-generated portfolios, mastery reports, and time-on-task logs for the states and homeschool umbrellas that require them.",
      },
    ],
    outcomes: [
      "Up to 10 learners under one Family plan",
      "State-standards-aligned reports for record-keeping requirements",
      "Works for any philosophy — classical, Charlotte Mason, eclectic, unschool",
      "Sensory-friendly defaults and IEP-aware features for homeschooled SPED learners",
    ],
    faqs: [
      {
        q: "Does AIVO replace a full homeschool curriculum?",
        a: "AIVO is best as a personalized practice and progress engine alongside your chosen curriculum. Many homeschool families use it to handle fluency, spiral review, and progress monitoring while they teach core lessons themselves.",
      },
      {
        q: "Can we use AIVO co-op style with other families?",
        a: "Each Family plan covers one household with up to 10 learners. Co-ops with multiple households should contact us for a small-school plan with admin views.",
      },
    ],
  },
];

export type LevelInfo = {
  level: 1 | 2 | 3 | 4 | 5;
  slug: string;
  name: string;
  short: string;
  metaTitle: string;
  metaDescription: string;
  who: string;
  features: string[];
  accommodations: string[];
  sample: string[];
};

export const LEVELS: LevelInfo[] = [
  {
    level: 1,
    slug: "1",
    name: "Standard",
    short: "Grade-level academics with adaptive pacing",
    metaTitle: "Functioning Level 1: Standard – Grade-Aligned AI Tutoring",
    metaDescription:
      "AIVO Level 1 (Standard) delivers grade-aligned academics with adaptive pacing and enrichment for learners on grade level. Personalized AI tutoring across math, ELA, science, and more.",
    who: "Learners working on or above grade level who benefit from adaptive pacing, deeper enrichment, and personalized practice across every core subject.",
    features: [
      "Grade-aligned scope and sequence (K–12)",
      "Adaptive difficulty across all 14 tutors",
      "Enrichment paths for advanced learners",
      "Standardized-assessment-style practice",
    ],
    accommodations: [
      "Read-aloud on demand",
      "Adjustable session length",
      "Topic interest tagging",
    ],
    sample: [
      "Multi-step word problems with hint scaffolds",
      "Close-reading comprehension with author's craft",
      "Lab simulations with hypothesis tracking",
    ],
  },
  {
    level: 2,
    slug: "2",
    name: "Supported",
    short: "Modified curriculum with scaffolding & visual supports",
    metaTitle: "Functioning Level 2: Supported – Scaffolded AI Tutoring",
    metaDescription:
      "AIVO Level 2 (Supported) provides modified curriculum with visual scaffolding, extended time, and simplified instructions for learners who benefit from extra support.",
    who: "Learners who benefit from modified instruction, visual scaffolding, extended time, and chunked tasks — common for many 504 plans and mild IEPs.",
    features: [
      "Modified curriculum with chunked tasks",
      "Visual scaffolding on every problem",
      "Extended-time pacing built in",
      "Simplified, plain-language instructions",
    ],
    accommodations: [
      "Visual schedules and task chunking",
      "Reduced answer choices",
      "Frequent positive reinforcement",
    ],
    sample: [
      "Math problems with manipulatives and step-by-step prompts",
      "Reading with picture support and sentence-by-sentence pacing",
      "Writing with sentence frames and word banks",
    ],
  },
  {
    level: 3,
    slug: "3",
    name: "Guided",
    short: "Step-by-step instruction with sensory accommodations",
    metaTitle: "Functioning Level 3: Guided – Step-by-Step AI Tutoring with AAC",
    metaDescription:
      "AIVO Level 3 (Guided) delivers structured, step-by-step instruction with sensory accommodations and AAC integration for learners who need explicit guidance.",
    who: "Learners who need explicit, step-by-step instruction with sensory accommodations and AAC integration — often Level 1 or Level 2 ASD support, moderate cognitive disabilities, or significant communication needs.",
    features: [
      "Step-by-step explicit instruction",
      "AAC device integration (TouchChat, Proloquo2Go, LAMP)",
      "Sensory profile controls",
      "Errorless-learning mode",
    ],
    accommodations: [
      "AAC symbol support",
      "Reduced sensory load by default",
      "Predictable lesson structure",
    ],
    sample: [
      "Daily-living math with photo-based prompts",
      "Functional reading with AAC response support",
      "Communication-temptation activities for requesting and commenting",
    ],
  },
  {
    level: 4,
    slug: "4",
    name: "Exploratory",
    short: "Cause-and-effect learning with switch access",
    metaTitle: "Functioning Level 4: Exploratory – Switch-Accessible AI Activities",
    metaDescription:
      "AIVO Level 4 (Exploratory) supports cause-and-effect learning with high-contrast visuals, switch access, and partner-assisted scanning for learners with significant disabilities.",
    who: "Learners working on cause-and-effect, joint attention, and emerging intentional communication. Switch access, eye-gaze compatibility, and high-contrast visuals are first-class.",
    features: [
      "Cause-and-effect activities",
      "Single-switch and two-switch access",
      "Eye-gaze compatibility",
      "High-contrast, low-clutter visuals",
    ],
    accommodations: [
      "Slow auto-scan with adjustable dwell",
      "Audio-first or visual-first toggles",
      "Predictable, pause-friendly interactions",
    ],
    sample: [
      "Activate-an-action cause-and-effect games",
      "Choice-making with two high-contrast options",
      "Auditory-scan music and story experiences",
    ],
  },
  {
    level: 5,
    slug: "5",
    name: "Pre-Symbolic",
    short: "Sensory engagement and partner-assisted communication",
    metaTitle: "Functioning Level 5: Pre-Symbolic – Sensory AI Engagement",
    metaDescription:
      "AIVO Level 5 (Pre-Symbolic) provides sensory stimulation and partner-assisted communication experiences for emerging-communication learners.",
    who: "Emerging-communication learners working on sensory engagement, joint attention, and partner-assisted communication. Designed for use with a learning partner present.",
    features: [
      "Sensory stimulation experiences",
      "Partner-assisted communication scripts",
      "Eye-gaze and proximity sensors",
      "Low-arousal sensory profiles by default",
    ],
    accommodations: [
      "Co-active sessions with caregiver or therapist",
      "Adjustable sensory intensity",
      "Predictable, looping experiences",
    ],
    sample: [
      "Multi-modal sensory stories with caregiver narration",
      "Partner-assisted music engagement",
      "Object-permanence and routine-based interactions",
    ],
  },
];

export type SubjectInfo = {
  slug: string;
  name: string;
  tutorName: string;
  metaTitle: string;
  metaDescription: string;
  short: string;
  what: string;
  features: string[];
  topics: string[];
};

export const SUBJECTS: SubjectInfo[] = [
  {
    slug: "math",
    name: "Math",
    tutorName: "Nova",
    metaTitle: "AI Math Tutor for Kids – Personalized K-12 Math with AIVO",
    metaDescription:
      "Nova is AIVO's AI math tutor for kids ages 3–18. Adaptive problem sets, visual manipulatives, and IEP-aware pacing across pre-K to algebra II.",
    short: "Adaptive math practice from counting to algebra II",
    what: "Nova builds a personalized math Brain Clone for every learner — covering pre-K number sense through algebra II — with visual manipulatives, multiple solution paths, and instant scaffolded hints.",
    features: [
      "Adaptive problem sets across K–12",
      "Visual math manipulatives (number lines, base-10, fraction tiles)",
      "Multi-strategy hint system",
      "IEP-aware pacing and accommodations",
    ],
    topics: [
      "Number sense and counting",
      "Addition, subtraction, multiplication, division",
      "Fractions, decimals, percents",
      "Pre-algebra and algebra I/II",
      "Geometry and measurement",
      "Word problems and reasoning",
    ],
  },
  {
    slug: "reading",
    name: "Reading & ELA",
    tutorName: "Sage",
    metaTitle: "AI Reading Tutor for Kids – Adaptive Reading with AIVO",
    metaDescription:
      "Sage is AIVO's AI reading and ELA tutor. Phonics, fluency, comprehension, and writing — adaptive across every reading level, including for dyslexic and ELL learners.",
    short: "Phonics, fluency, comprehension, and writing",
    what: "Sage delivers a structured-literacy-aligned reading and ELA path — from phonemic awareness through college-prep close reading — with built-in support for dyslexic learners and English language learners.",
    features: [
      "Structured-literacy-aligned phonics",
      "Decodable readers with audio support",
      "Comprehension Q&A with rereading prompts",
      "Writing workshops with constructive feedback",
    ],
    topics: [
      "Phonemic awareness and phonics",
      "Fluency and prosody practice",
      "Vocabulary in context",
      "Comprehension: literal, inferential, evaluative",
      "Narrative, expository, and persuasive writing",
      "Grammar and conventions",
    ],
  },
  {
    slug: "science",
    name: "Science",
    tutorName: "Spark",
    metaTitle: "AI Science Tutor for Kids – Hands-On Science with AIVO",
    metaDescription:
      "Spark is AIVO's AI science tutor. NGSS-aligned virtual labs and inquiry-based simulations from elementary through high school physics, chemistry, and biology.",
    short: "Virtual labs and inquiry across NGSS strands",
    what: "Spark turns every concept into an investigation. NGSS-aligned virtual labs, simulations, and guided inquiry across life, earth, and physical sciences from elementary through high school.",
    features: [
      "Interactive virtual labs and simulations",
      "Guided scientific-method scaffolds",
      "Real-world phenomena connections",
      "NGSS three-dimensional alignment",
    ],
    topics: [
      "Life science: cells, genetics, ecosystems",
      "Physical science: forces, energy, waves",
      "Earth and space science",
      "Chemistry: matter, reactions, stoichiometry",
      "Physics: motion, electricity, magnetism",
      "Engineering design and STEM challenges",
    ],
  },
  {
    slug: "writing",
    name: "Writing",
    tutorName: "Muse",
    metaTitle: "AI Writing Tutor for Kids – Creative & Academic Writing",
    metaDescription:
      "Muse is AIVO's AI writing tutor. Narrative, expository, persuasive, and creative writing with constructive feedback and writing process scaffolds.",
    short: "From sentence frames to college-prep essays",
    what: "Muse coaches writers through every stage — brainstorm, draft, revise, edit, publish — with sentence-level supports for emerging writers and Socratic-style feedback for advanced ones.",
    features: [
      "Process-based writing workshops",
      "Sentence frames and word banks for emerging writers",
      "Revision-focused feedback (not just grammar)",
      "Creative-expression and journaling modes",
    ],
    topics: [
      "Personal narrative and memoir",
      "Informational and expository writing",
      "Argumentative and persuasive essays",
      "Creative writing: poetry, fiction, scripts",
      "Research and citation",
      "Grammar, mechanics, and style",
    ],
  },
  {
    slug: "speech",
    name: "Speech & Communication",
    tutorName: "Echo",
    metaTitle: "AI Speech & AAC Tutor – AIVO Echo for Communication Goals",
    metaDescription:
      "Echo is AIVO's AI speech and communication tutor. AAC-integrated, articulation, fluency, language, and pragmatics goals for SLPs, special-education teachers, and families.",
    short: "AAC-integrated speech, language, and pragmatics",
    what: "Echo collaborates with families and SLPs on articulation, expressive and receptive language, fluency, and pragmatic-language goals — with AAC, switch, and eye-gaze access built in.",
    features: [
      "AAC integration (TouchChat, Proloquo2Go, LAMP)",
      "Articulation practice with phoneme targeting",
      "Expressive and receptive language activities",
      "Pragmatic-language scenarios and role-play",
    ],
    topics: [
      "Articulation and phonological skills",
      "Expressive and receptive vocabulary",
      "Sentence structure and syntax",
      "Pragmatic and social language",
      "Fluency (stuttering) practice",
      "AAC-supported requesting, commenting, and answering",
    ],
  },
  {
    slug: "languages",
    name: "World Languages",
    tutorName: "Lingua",
    metaTitle: "AI World Languages Tutor – Spanish, French, Mandarin & more",
    metaDescription:
      "Lingua is AIVO's AI world-languages tutor. Immersive Spanish, French, Mandarin, and more with speech-recognition pronunciation and culture-rich lessons.",
    short: "Immersive language learning for Spanish, French, Mandarin & more",
    what: "Lingua teaches world languages through immersive scenarios, speech-recognition pronunciation feedback, and culture-rich lessons that go beyond vocabulary drills.",
    features: [
      "Speech-recognition pronunciation feedback",
      "Immersive scenario-based dialogues",
      "Culture-integrated lessons",
      "Multi-skill practice (listen, speak, read, write)",
    ],
    topics: [
      "Spanish",
      "French",
      "Mandarin Chinese",
      "German",
      "ASL fundamentals",
      "Beginner literacy in 6+ languages",
    ],
  },
];

export type ComparisonSpec = {
  slug: string;
  competitor: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  bestFor: { aivo: string; competitor: string };
  rows: { feature: string; aivo: string; competitor: string }[];
  honest: string;
  closer: string;
};

export const COMPARISONS: ComparisonSpec[] = [
  {
    slug: "aivo-vs-ixl",
    competitor: "IXL",
    metaTitle: "AIVO vs IXL: Which AI Learning Platform Fits Your Family?",
    metaDescription:
      "Compare AIVO Learning and IXL across personalization, IEP support, AAC compatibility, pricing, and SPED features. Honest, side-by-side comparison.",
    intro:
      "IXL is one of the most widely used K-12 skills-practice platforms in the US, with millions of students drilling grade-level skills every day. AIVO is built for a different job: a personalized AI tutor team that adapts to every learner — including kids with IEPs, AAC, and complex sensory profiles. Here is an honest, feature-by-feature comparison.",
    bestFor: {
      aivo: "Families and schools that need true personalization across IEP/504 plans, AAC users, sensory profiles, and multi-subject support — not just grade-level drills.",
      competitor:
        "Families and schools that want a low-cost, breadth-first practice tool for grade-level skills with strong analytics for typically developing learners.",
    },
    rows: [
      { feature: "Core model", aivo: "AI Brain Clone that adapts in real time", competitor: "Skill tree with diagnostic / SmartScore" },
      { feature: "AI tutors", aivo: "14 specialized AI tutors", competitor: "No conversational AI tutor" },
      { feature: "IEP integration", aivo: "Built-in: goal libraries, progress notes", competitor: "None native" },
      { feature: "AAC / switch / eye-gaze", aivo: "First-class support across all levels", competitor: "Not supported" },
      { feature: "Functioning levels", aivo: "5 (standard → pre-symbolic)", competitor: "Grade-level only" },
      { feature: "Sensory profiles", aivo: "Yes — visuals, audio, pacing", competitor: "Limited" },
      { feature: "Family pricing", aivo: "$19.99/mo per learner (Family plan, 2+ learners)", competitor: "From $9.95/mo (Family plan)" },
      { feature: "School / district pricing", aivo: "Volume; from low single-digit $/student/year", competitor: "Volume; widely deployed" },
      { feature: "Money-back guarantee", aivo: "30 days", competitor: "30 days" },
      { feature: "COPPA, FERPA, SOC 2", aivo: "Yes / Yes / Type II", competitor: "Yes / Yes / Yes" },
      { feature: "WCAG 2.2 AA VPAT", aivo: "Yes", competitor: "Partial" },
    ],
    honest:
      "IXL is more affordable, has a deeper bench of grade-level skills, and is in more districts than we are. If your family or school just needs grade-level practice for typically-developing learners, IXL is a great choice. AIVO costs more because it does more — true differentiation, IEP-grade progress monitoring, AAC integration, and pre-symbolic supports that IXL was never designed to provide.",
    closer:
      "Try AIVO free for 30 days. If your child's mix of needs lines up better with IXL, you can switch — no hard feelings. We just don't think any child should be stuck with a tool that can't adapt to them.",
  },
  {
    slug: "aivo-vs-khan-academy",
    competitor: "Khan Academy",
    metaTitle: "AIVO vs Khan Academy: How AIVO Differs from Khan",
    metaDescription:
      "Compare AIVO Learning and Khan Academy across personalization, IEP support, AAC compatibility, and pricing. Khan is free; AIVO is built for personalized SPED-friendly tutoring.",
    intro:
      "Khan Academy is a remarkable, free, mission-driven library of lessons that has educated tens of millions of learners. AIVO is a different product: a paid, personalized AI tutor team that adapts to each learner's profile — especially for learners with IEPs, AAC users, and the full range of functioning levels Khan does not target.",
    bestFor: {
      aivo: "Families and schools that need an AI tutor that personalizes in real time, supports IEPs and AAC, and consolidates multiple specialty apps into one.",
      competitor: "Anyone who wants free, breadth-first lessons across math, science, humanities and beyond — and who doesn't need IEP or AAC support.",
    },
    rows: [
      { feature: "Pricing", aivo: "Free trial, then $19.99–$24.99/mo per learner", competitor: "Free, forever" },
      { feature: "Personalization", aivo: "AI Brain Clone, real-time adaptation", competitor: "Mastery system, skill maps" },
      { feature: "AI tutor", aivo: "14 specialized AI tutors", competitor: "Khanmigo (paid add-on)" },
      { feature: "IEP integration", aivo: "Goal libraries, progress notes built in", competitor: "Not native" },
      { feature: "AAC / switch / eye-gaze", aivo: "Yes — first-class", competitor: "Not supported" },
      { feature: "Functioning levels", aivo: "5 (standard → pre-symbolic)", competitor: "Grade-level only" },
      { feature: "Sensory profiles", aivo: "Yes", competitor: "No" },
      { feature: "Districts", aivo: "Volume pricing, dedicated CSM", competitor: "Khan Academy Districts (limited regions)" },
      { feature: "WCAG 2.2 AA VPAT", aivo: "Yes", competitor: "Partial" },
    ],
    honest:
      "Khan Academy is free. That is genuinely amazing, and for learners on grade level who can self-direct, it may be all you need. AIVO charges because we serve a different mandate: personalized AI tutoring for every learner, including the ones general-purpose libraries don't reach — kids with significant communication needs, complex IEPs, and sensory profiles that demand a tool built for them.",
    closer:
      "Use both. Lots of AIVO families pair our personalized tutors and progress monitoring with Khan's free content library. If your family only needs grade-level lessons, Khan alone is a great pick.",
  },
];
