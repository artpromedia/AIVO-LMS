import type { FrameworkId, SkillGraph, Subject } from "../types.js";

interface PreKFoundation {
  id: string;
  title: string;
  source: string;
  framework: FrameworkId;
  subject: Subject;
  gradeBand: "PRE_K";
  skillId: string;
  skillTitle: string;
  description: string;
  code: string;
}

function makePreKGraph(input: PreKFoundation): SkillGraph {
  return {
    id: input.id,
    title: input.title,
    version: "0.1.0-draft",
    source: input.source,
    framework: input.framework,
    subject: input.subject,
    gradeBand: input.gradeBand,
    skills: [
      {
        id: input.skillId,
        title: input.skillTitle,
        description: input.description,
        subject: input.subject,
        gradeBand: "PRE_K",
        frameworkRefs: [{ framework: input.framework, code: input.code }],
        prerequisites: [],
      },
    ],
  };
}

export const preKMathFoundations: SkillGraph = makePreKGraph({
  id: "prek-math-foundations",
  title: "Pre-K Math Foundations",
  source: "CCSS-Math aligned early numeracy readiness",
  framework: "CCSS-Math",
  subject: "math",
  gradeBand: "PRE_K",
  skillId: "prek.math.notice-quantity",
  skillTitle: "Notice small quantities",
  description: "I can notice when a group has one, two, or many things.",
  code: "PK.CC.Readiness",
});

export const preKElaFoundations: SkillGraph = makePreKGraph({
  id: "prek-ela-foundations",
  title: "Pre-K Language Foundations",
  source: "CCSS-ELA aligned early language readiness",
  framework: "CCSS-ELA",
  subject: "ela",
  gradeBand: "PRE_K",
  skillId: "prek.ela.listen-respond",
  skillTitle: "Listen and respond",
  description: "I can respond to a short story, rhyme, or question.",
  code: "PK.SL.Readiness",
});

export const preKWritingFoundations: SkillGraph = makePreKGraph({
  id: "prek-writing-foundations",
  title: "Pre-K Writing Foundations",
  source: "CCSS-ELA aligned early expression readiness",
  framework: "CCSS-ELA",
  subject: "writing",
  gradeBand: "PRE_K",
  skillId: "prek.writing.make-a-mark",
  skillTitle: "Use marks to share an idea",
  description: "I can draw, trace, or make marks to share an idea.",
  code: "PK.W.Readiness",
});

export const preKScienceFoundations: SkillGraph = makePreKGraph({
  id: "prek-science-foundations",
  title: "Pre-K Science Foundations",
  source: "NGSS aligned early inquiry readiness",
  framework: "NGSS",
  subject: "science",
  gradeBand: "PRE_K",
  skillId: "prek.science.observe",
  skillTitle: "Observe the world",
  description: "I can use my senses to notice and describe something.",
  code: "PK.Inquiry.Readiness",
});

export const preKSelFoundations: SkillGraph = makePreKGraph({
  id: "prek-sel-foundations",
  title: "Pre-K SEL Foundations",
  source: "CASEL aligned early social-emotional readiness",
  framework: "CASEL",
  subject: "sel",
  gradeBand: "PRE_K",
  skillId: "prek.sel.name-feeling",
  skillTitle: "Notice a feeling",
  description: "I can notice and communicate how I feel.",
  code: "PK.SelfAwareness",
});

export const preKSpeechFoundations: SkillGraph = makePreKGraph({
  id: "prek-speech-foundations",
  title: "Pre-K Speech Foundations",
  source: "ASHA aligned early communication readiness",
  framework: "ASHA",
  subject: "speech",
  gradeBand: "PRE_K",
  skillId: "prek.speech.take-turn",
  skillTitle: "Take a communication turn",
  description: "I can take a turn using words, sounds, signs, or AAC.",
  code: "PK.Communication.TurnTaking",
});

export const preKExecutiveFunctionFoundations: SkillGraph = makePreKGraph({
  id: "prek-executive-function-foundations",
  title: "Pre-K Executive Function Foundations",
  source: "CEC aligned early executive-function readiness",
  framework: "CEC-LS",
  subject: "executive_function",
  gradeBand: "PRE_K",
  skillId: "prek.executive-function.follow-routine",
  skillTitle: "Follow one routine step",
  description: "I can follow one familiar routine step with support.",
  code: "PK.EF.Routine",
});

export const preKLifeSkillsFoundations: SkillGraph = makePreKGraph({
  id: "prek-life-skills-foundations",
  title: "Pre-K Life Skills Foundations",
  source: "CEC aligned early daily-living readiness",
  framework: "CEC-LS",
  subject: "life_skills",
  gradeBand: "PRE_K",
  skillId: "prek.life-skills.make-choice",
  skillTitle: "Make a daily choice",
  description: "I can make a choice during a familiar daily routine.",
  code: "PK.DailyLiving.Choice",
});

export const preKCreativeArtsFoundations: SkillGraph = makePreKGraph({
  id: "prek-creative-arts-foundations",
  title: "Pre-K Creative Arts Foundations",
  source: "NCAS aligned early creative-expression readiness",
  framework: "NCAS",
  subject: "creative_arts",
  gradeBand: "PRE_K",
  skillId: "prek.creative-arts.explore-material",
  skillTitle: "Explore an art material",
  description: "I can explore color, shape, movement, or texture.",
  code: "PK.Create.Explore",
});

export const preKSocialStudiesFoundations: SkillGraph = makePreKGraph({
  id: "prek-social-studies-foundations",
  title: "Pre-K Social Studies Foundations",
  source: "C3 aligned early community readiness",
  framework: "C3",
  subject: "social_studies",
  gradeBand: "PRE_K",
  skillId: "prek.social-studies.community-role",
  skillTitle: "Recognize a community helper",
  description: "I can recognize someone who helps in my community.",
  code: "PK.Civics.Community",
});

export const preKWorldLanguagesFoundations: SkillGraph = makePreKGraph({
  id: "prek-world-languages-foundations",
  title: "Pre-K World Languages Foundations",
  source: "ACTFL aligned early language-awareness readiness",
  framework: "ACTFL",
  subject: "world_languages",
  gradeBand: "PRE_K",
  skillId: "prek.world-languages.greeting",
  skillTitle: "Notice a greeting in another language",
  description: "I can listen to and respond to a greeting in another language.",
  code: "PK.Communication.Greeting",
});

export const preKCodingFoundations: SkillGraph = makePreKGraph({
  id: "prek-coding-foundations",
  title: "Pre-K Coding Foundations",
  source: "CSTA aligned early computational-thinking readiness",
  framework: "CSTA",
  subject: "coding",
  gradeBand: "PRE_K",
  skillId: "prek.coding.sequence",
  skillTitle: "Put two steps in order",
  description: "I can put two familiar actions in order.",
  code: "PK.AP.Sequence",
});

export const preKGeographyFoundations: SkillGraph = makePreKGraph({
  id: "prek-geography-foundations",
  title: "Pre-K Geography Foundations",
  source: "NCGE aligned early spatial-awareness readiness",
  framework: "NCGE",
  subject: "geography",
  gradeBand: "PRE_K",
  skillId: "prek.geography.place",
  skillTitle: "Recognize a familiar place",
  description: "I can recognize and describe a familiar place.",
  code: "PK.Places.Readiness",
});

export const preKMusicFoundations: SkillGraph = makePreKGraph({
  id: "prek-music-foundations",
  title: "Pre-K Music Foundations",
  source: "NCAS aligned early music readiness",
  framework: "NCAS",
  subject: "music",
  gradeBand: "PRE_K",
  skillId: "prek.music.keep-beat",
  skillTitle: "Move with a steady beat",
  description: "I can clap, tap, or move with a steady beat.",
  code: "PK.Music.Perform",
});

export const preKPeHealthFoundations: SkillGraph = makePreKGraph({
  id: "prek-pe-health-foundations",
  title: "Pre-K PE and Health Foundations",
  source: "SHAPE aligned early movement and health readiness",
  framework: "SHAPE",
  subject: "pe_health",
  gradeBand: "PRE_K",
  skillId: "prek.pe-health.move-safely",
  skillTitle: "Move safely",
  description: "I can move my body safely in my space.",
  code: "PK.Movement.Safety",
});

export const preKStemEngineeringFoundations: SkillGraph = makePreKGraph({
  id: "prek-stem-engineering-foundations",
  title: "Pre-K STEM Engineering Foundations",
  source: "NGSS Engineering aligned early design readiness",
  framework: "NGSS-Engineering",
  subject: "stem_engineering",
  gradeBand: "PRE_K",
  skillId: "prek.stem-engineering.build-test",
  skillTitle: "Build and try",
  description: "I can build something simple and see what happens.",
  code: "PK.ETS.Readiness",
});
