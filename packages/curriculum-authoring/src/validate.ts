import { K8CurriculumPackSchema, type K8CurriculumPack } from "./schemas.js";

export interface CurriculumPackIssue {
  code:
    | "schema_invalid"
    | "duplicate_standard"
    | "duplicate_skill"
    | "duplicate_template"
    | "duplicate_item"
    | "unknown_standard"
    | "unknown_skill"
    | "skill_subject_mismatch"
    | "skill_grade_mismatch"
    | "cycle_detected"
    | "missing_sped_review"
    | "missing_subject_review"
    | "not_sme_approved";
  path: string;
  detail: string;
}

export interface CurriculumPackValidationResult {
  ok: boolean;
  pack?: K8CurriculumPack;
  issues: CurriculumPackIssue[];
}

const SUBJECT_REVIEW_ROLE: Record<K8CurriculumPack["skills"][number]["subject"], string> = {
  math: "math_curriculum_designer",
  ela: "ela_curriculum_designer",
  science: "science_curriculum_designer",
  writing: "writing_curriculum_designer",
};

function issue(code: CurriculumPackIssue["code"], path: string, detail: string): CurriculumPackIssue {
  return { code, path, detail };
}

function assertApproved(review: { status: string }, path: string, issues: CurriculumPackIssue[]) {
  if (review.status !== "sme_approved") {
    issues.push(issue("not_sme_approved", path, "Production curriculum content must be SME approved before import."));
  }
}

export function validateK8CurriculumPack(input: unknown): CurriculumPackValidationResult {
  const parsed = K8CurriculumPackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((zodIssue) =>
        issue("schema_invalid", zodIssue.path.join("."), zodIssue.message),
      ),
    };
  }

  const pack = parsed.data;
  const issues: CurriculumPackIssue[] = [];

  const standards = new Set<string>();
  for (const [i, standard] of pack.standards.entries()) {
    if (standards.has(standard.code)) issues.push(issue("duplicate_standard", `standards.${i}.code`, `Duplicate standard code ${standard.code}.`));
    standards.add(standard.code);
  }

  const skills = new Map<string, K8CurriculumPack["skills"][number]>();
  for (const [i, skill] of pack.skills.entries()) {
    if (skills.has(skill.id)) issues.push(issue("duplicate_skill", `skills.${i}.id`, `Duplicate skill id ${skill.id}.`));
    skills.set(skill.id, skill);
    assertApproved(skill.review, `skills.${i}.review.status`, issues);
    for (const code of skill.standardCodes) {
      if (!standards.has(code)) issues.push(issue("unknown_standard", `skills.${i}.standardCodes`, `Skill ${skill.id} references unknown standard ${code}.`));
    }
  }

  const templates = new Set<string>();
  for (const [i, template] of pack.templates.entries()) {
    if (templates.has(template.id)) issues.push(issue("duplicate_template", `templates.${i}.id`, `Duplicate template id ${template.id}.`));
    templates.add(template.id);
    assertApproved(template.review, `templates.${i}.review.status`, issues);
    for (const code of template.baseStandards) {
      if (!standards.has(code)) issues.push(issue("unknown_standard", `templates.${i}.baseStandards`, `Template ${template.id} references unknown standard ${code}.`));
    }
    for (const [u, unit] of template.unitBlueprints.entries()) {
      assertApproved(unit.review, `templates.${i}.unitBlueprints.${u}.review.status`, issues);
      for (const skillId of unit.skillIds) {
        const skill = skills.get(skillId);
        if (!skill) {
          issues.push(issue("unknown_skill", `templates.${i}.unitBlueprints.${u}.skillIds`, `Unit references unknown skill ${skillId}.`));
        } else if (skill.subject !== template.subject) {
          issues.push(issue("skill_subject_mismatch", `templates.${i}.unitBlueprints.${u}.skillIds`, `Skill ${skillId} is ${skill.subject}, not ${template.subject}.`));
        } else if (skill.gradeBand !== template.gradeBand) {
          issues.push(issue("skill_grade_mismatch", `templates.${i}.unitBlueprints.${u}.skillIds`, `Skill ${skillId} is gradeBand ${skill.gradeBand}, not ${template.gradeBand}.`));
        }
      }
      for (const [l, lesson] of unit.lessonTopics.entries()) {
        assertApproved(lesson.review, `templates.${i}.unitBlueprints.${u}.lessonTopics.${l}.review.status`, issues);
        for (const skillId of lesson.skillIds) {
          if (!skills.has(skillId)) issues.push(issue("unknown_skill", `templates.${i}.unitBlueprints.${u}.lessonTopics.${l}.skillIds`, `Lesson references unknown skill ${skillId}.`));
        }
      }
    }
  }

  const items = new Set<string>();
  for (const [i, item] of pack.itemBankItems.entries()) {
    if (items.has(item.id)) issues.push(issue("duplicate_item", `itemBankItems.${i}.id`, `Duplicate item id ${item.id}.`));
    items.add(item.id);
    assertApproved(item.review, `itemBankItems.${i}.review.status`, issues);
    const skill = skills.get(item.skillId);
    if (!skill) {
      issues.push(issue("unknown_skill", `itemBankItems.${i}.skillId`, `Item ${item.id} references unknown skill ${item.skillId}.`));
      continue;
    }
    if (skill.subject !== item.subject) issues.push(issue("skill_subject_mismatch", `itemBankItems.${i}.subject`, `Item ${item.id} subject ${item.subject} does not match skill ${skill.subject}.`));
    if (skill.gradeBand !== item.gradeBand) issues.push(issue("skill_grade_mismatch", `itemBankItems.${i}.gradeBand`, `Item ${item.id} gradeBand ${item.gradeBand} does not match skill ${skill.gradeBand}.`));
  }

  for (const [skillId, skill] of skills.entries()) {
    for (const pre of skill.prerequisiteSkillIds) {
      if (!skills.has(pre)) issues.push(issue("unknown_skill", `skills.${skillId}.prerequisiteSkillIds`, `Skill ${skillId} references unknown prerequisite ${pre}.`));
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (skillId: string, path: string[]): void => {
    if (visiting.has(skillId)) {
      issues.push(issue("cycle_detected", `skills.${skillId}.prerequisiteSkillIds`, `Cycle detected: ${[...path, skillId].join(" -> ")}.`));
      return;
    }
    if (visited.has(skillId)) return;
    const skill = skills.get(skillId);
    if (!skill) return;
    visiting.add(skillId);
    for (const pre of skill.prerequisiteSkillIds) visit(pre, [...path, skillId]);
    visiting.delete(skillId);
    visited.add(skillId);
  };
  for (const skillId of skills.keys()) visit(skillId, []);

  const packReviews = pack.metadata.expertReviews.filter((r) => r.status === "sme_approved");
  const packRoles = new Set(packReviews.map((r) => r.reviewerRole).filter(Boolean));
  if (!packRoles.has("sped_specialist")) {
    issues.push(issue("missing_sped_review", "metadata.expertReviews", "K-8 curriculum pack requires a SPED specialist approval before production import."));
  }
  for (const subject of new Set(pack.skills.map((s) => s.subject))) {
    const requiredRole = SUBJECT_REVIEW_ROLE[subject];
    if (!packRoles.has(requiredRole)) {
      issues.push(issue("missing_subject_review", "metadata.expertReviews", `Curriculum pack includes ${subject}; requires ${requiredRole} approval.`));
    }
  }

  return { ok: issues.length === 0, pack, issues };
}
