import type { ItemBank } from "@aivo/item-bank";
import type { SkillGraph } from "@aivo/skill-graphs";
import type { CurriculumSubject, K8CurriculumPack } from "./types.js";

const FRAMEWORK_BY_SUBJECT: Record<CurriculumSubject, SkillGraph["framework"]> = {
  math: "CCSS-Math",
  ela: "CCSS-ELA",
  science: "NGSS",
  writing: "CCSS-ELA",
};

export function toSkillGraphs(pack: K8CurriculumPack): SkillGraph[] {
  const groups = new Map<string, K8CurriculumPack["skills"]>();
  for (const skill of pack.skills) {
    const key = `${skill.subject}:${skill.gradeBand}`;
    const list = groups.get(key) ?? [];
    list.push(skill);
    groups.set(key, list);
  }

  // `CurriculumSubject` includes "writing" because authors organize content
  // that way, but the skill-graph layer treats writing as part of ELA
  // (matches `FRAMEWORK_BY_SUBJECT` above — both map to CCSS-ELA).
  const toSkillGraphSubject = (s: CurriculumSubject): SkillGraph["subject"] =>
    s === "writing" ? "ela" : s;

  return [...groups.entries()].map(([key, skills]) => {
    const [subject, gradeBand] = key.split(":") as [CurriculumSubject, SkillGraph["gradeBand"]];
    return {
      id: `${pack.metadata.version}.${subject}.${gradeBand}.k8-authoring`,
      title: `${pack.metadata.name} — ${subject.toUpperCase()} Grade ${gradeBand}`,
      version: pack.metadata.version,
      source: `${pack.metadata.publisher}; ${pack.metadata.academicYear}; ${pack.metadata.sourceNotes ?? "SME-authored K-8 curriculum pack"}`,
      framework: FRAMEWORK_BY_SUBJECT[subject],
      subject: toSkillGraphSubject(subject),
      gradeBand,
      skills: skills.map((skill) => ({
        id: skill.id,
        title: skill.title,
        description: skill.description,
        subject: toSkillGraphSubject(skill.subject),
        gradeBand: skill.gradeBand,
        frameworkRefs: skill.standardCodes.map((code) => {
          const standard = pack.standards.find((s) => s.code === code);
          return {
            framework: FRAMEWORK_BY_SUBJECT[skill.subject],
            code,
            label: standard?.description,
          };
        }),
        prerequisites: skill.prerequisiteSkillIds,
      })),
    };
  });
}

export function toItemBank(pack: K8CurriculumPack): ItemBank {
  return {
    id: `${pack.metadata.version}.k8-authoring`,
    schemaVersion: 1,
    defectBudget: 3,
    items: pack.itemBankItems.map((item) => ({
      id: item.id,
      skillId: item.skillId,
      authoringMeta: {
        subject: item.subject,
        gradeBand: item.gradeBand,
        cognitiveLevel: item.cognitiveLevel,
        difficulty: String(item.difficulty),
        reviewStatus: item.review.status,
      },
      variants: [
        {
          id: `${item.id}@${pack.metadata.version}`,
          itemId: item.id,
          version: pack.metadata.version,
          status: "active",
          cohortWeight: 1,
          publishedAt: item.review.reviewedAt ?? new Date(0).toISOString(),
          body: {
            questionType: item.questionType,
            prompt: item.prompt,
            choices: item.choices ?? [],
            correctAnswer: item.correctAnswer ?? null,
            scoringRubric: item.scoringRubric ?? null,
            standardCodes: item.standardCodes,
            accessibilitySupports: item.accessibilitySupports,
          },
          defectCount: 0,
        },
      ],
    })),
  };
}
