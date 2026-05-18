import { K8_CURRICULUM_SCHEMA_VERSION, type CurriculumSubject, type K8CurriculumPack } from "./types.js";

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

const SUBJECT_REVIEW_ROLE: Record<CurriculumSubject, string> = {
  math: "math_curriculum_designer",
  ela: "ela_curriculum_designer",
  science: "science_curriculum_designer",
  writing: "writing_curriculum_designer",
};

const SUBJECTS = new Set(["math", "ela", "science", "writing"]);
const GRADE_BANDS = new Set(["K", "1", "2", "3", "4", "5", "6", "7", "8"]);
const APPROVED = "sme_approved";

function issue(code: CurriculumPackIssue["code"], path: string, detail: string): CurriculumPackIssue {
  return { code, path, detail };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function hasApprovedReview(value: unknown): boolean {
  return isObject(value) && value.status === APPROVED && isString(value.reviewerRole) && isString(value.reviewedBy) && isString(value.reviewedAt);
}

function assertApproved(review: unknown, path: string, issues: CurriculumPackIssue[]) {
  if (!hasApprovedReview(review)) {
    issues.push(issue("not_sme_approved", path, "Production curriculum content must have SME-approved review metadata."));
  }
}

function hasRequiredShape(input: unknown, issues: CurriculumPackIssue[]): input is K8CurriculumPack {
  if (!isObject(input)) {
    issues.push(issue("schema_invalid", "", "Pack must be a JSON object."));
    return false;
  }
  if (input.schemaVersion !== K8_CURRICULUM_SCHEMA_VERSION) {
    issues.push(issue("schema_invalid", "schemaVersion", `schemaVersion must be ${K8_CURRICULUM_SCHEMA_VERSION}.`));
  }
  if (!isObject(input.metadata)) issues.push(issue("schema_invalid", "metadata", "metadata is required."));
  if (!Array.isArray(input.standards)) issues.push(issue("schema_invalid", "standards", "standards must be an array."));
  if (!Array.isArray(input.skills)) issues.push(issue("schema_invalid", "skills", "skills must be an array."));
  if (!Array.isArray(input.templates)) issues.push(issue("schema_invalid", "templates", "templates must be an array."));
  if (input.itemBankItems !== undefined && !Array.isArray(input.itemBankItems)) {
    issues.push(issue("schema_invalid", "itemBankItems", "itemBankItems must be an array."));
  }
  return issues.filter((i) => i.code === "schema_invalid").length === 0;
}

export function validateK8CurriculumPack(input: unknown): CurriculumPackValidationResult {
  const issues: CurriculumPackIssue[] = [];
  if (!hasRequiredShape(input, issues)) return { ok: false, issues };

  const pack = input;
  const standards = new Set<string>();
  for (const [i, rawStandard] of pack.standards.entries()) {
    if (!isObject(rawStandard) || !isString(rawStandard.code) || !isString(rawStandard.description)) {
      issues.push(issue("schema_invalid", `standards.${i}`, "Each standard requires code and description."));
      continue;
    }
    if (standards.has(rawStandard.code)) issues.push(issue("duplicate_standard", `standards.${i}.code`, `Duplicate standard code ${rawStandard.code}.`));
    standards.add(rawStandard.code);
  }

  const skills = new Map<string, K8CurriculumPack["skills"][number]>();
  for (const [i, skill] of pack.skills.entries()) {
    if (!isObject(skill) || !isString(skill.id) || !isString(skill.subject) || !SUBJECTS.has(skill.subject) || !isString(skill.gradeBand) || !GRADE_BANDS.has(skill.gradeBand)) {
      issues.push(issue("schema_invalid", `skills.${i}`, "Each skill requires id, supported subject, and K-8 gradeBand."));
      continue;
    }
    if (skills.has(skill.id)) issues.push(issue("duplicate_skill", `skills.${i}.id`, `Duplicate skill id ${skill.id}.`));
    skills.set(skill.id, skill as K8CurriculumPack["skills"][number]);
    assertApproved(skill.review, `skills.${i}.review`, issues);
    if (!isStringArray(skill.standardCodes)) {
      issues.push(issue("schema_invalid", `skills.${i}.standardCodes`, "Skill standardCodes must be a non-empty string array."));
    } else {
      for (const code of skill.standardCodes) {
        if (!standards.has(code)) issues.push(issue("unknown_standard", `skills.${i}.standardCodes`, `Skill ${skill.id} references unknown standard ${code}.`));
      }
    }
  }

  const templates = new Set<string>();
  for (const [i, template] of pack.templates.entries()) {
    if (!isObject(template) || !isString(template.id) || !isString(template.subject) || !SUBJECTS.has(template.subject) || !isString(template.gradeBand) || !GRADE_BANDS.has(template.gradeBand)) {
      issues.push(issue("schema_invalid", `templates.${i}`, "Each template requires id, supported subject, and K-8 gradeBand."));
      continue;
    }
    if (templates.has(template.id)) issues.push(issue("duplicate_template", `templates.${i}.id`, `Duplicate template id ${template.id}.`));
    templates.add(template.id);
    assertApproved(template.review, `templates.${i}.review`, issues);
    const baseStandards = Array.isArray(template.baseStandards) ? template.baseStandards : [];
    for (const code of baseStandards) {
      if (typeof code === "string" && !standards.has(code)) issues.push(issue("unknown_standard", `templates.${i}.baseStandards`, `Template ${template.id} references unknown standard ${code}.`));
    }
    const units = Array.isArray(template.unitBlueprints) ? template.unitBlueprints : [];
    for (const [u, unit] of units.entries()) {
      if (!isObject(unit)) {
        issues.push(issue("schema_invalid", `templates.${i}.unitBlueprints.${u}`, "Unit blueprint must be an object."));
        continue;
      }
      assertApproved(unit.review, `templates.${i}.unitBlueprints.${u}.review`, issues);
      const unitSkills = Array.isArray(unit.skillIds) ? unit.skillIds : [];
      for (const skillId of unitSkills) {
        if (typeof skillId !== "string") continue;
        const skill = skills.get(skillId);
        if (!skill) {
          issues.push(issue("unknown_skill", `templates.${i}.unitBlueprints.${u}.skillIds`, `Unit references unknown skill ${skillId}.`));
        } else if (skill.subject !== template.subject) {
          issues.push(issue("skill_subject_mismatch", `templates.${i}.unitBlueprints.${u}.skillIds`, `Skill ${skillId} is ${skill.subject}, not ${template.subject}.`));
        } else if (skill.gradeBand !== template.gradeBand) {
          issues.push(issue("skill_grade_mismatch", `templates.${i}.unitBlueprints.${u}.skillIds`, `Skill ${skillId} is gradeBand ${skill.gradeBand}, not ${template.gradeBand}.`));
        }
      }
      const lessons = Array.isArray(unit.lessonTopics) ? unit.lessonTopics : [];
      for (const [l, lesson] of lessons.entries()) {
        if (!isObject(lesson)) {
          issues.push(issue("schema_invalid", `templates.${i}.unitBlueprints.${u}.lessonTopics.${l}`, "Lesson topic must be an object."));
          continue;
        }
        assertApproved(lesson.review, `templates.${i}.unitBlueprints.${u}.lessonTopics.${l}.review`, issues);
        const lessonSkills = Array.isArray(lesson.skillIds) ? lesson.skillIds : [];
        for (const skillId of lessonSkills) {
          if (typeof skillId === "string" && !skills.has(skillId)) issues.push(issue("unknown_skill", `templates.${i}.unitBlueprints.${u}.lessonTopics.${l}.skillIds`, `Lesson references unknown skill ${skillId}.`));
        }
      }
    }
  }

  const itemIds = new Set<string>();
  for (const [i, item] of pack.itemBankItems.entries()) {
    if (!isObject(item) || !isString(item.id) || !isString(item.skillId)) {
      issues.push(issue("schema_invalid", `itemBankItems.${i}`, "Each item requires id and skillId."));
      continue;
    }
    if (itemIds.has(item.id)) issues.push(issue("duplicate_item", `itemBankItems.${i}.id`, `Duplicate item id ${item.id}.`));
    itemIds.add(item.id);
    assertApproved(item.review, `itemBankItems.${i}.review`, issues);
    const skill = skills.get(item.skillId);
    if (!skill) {
      issues.push(issue("unknown_skill", `itemBankItems.${i}.skillId`, `Item ${item.id} references unknown skill ${item.skillId}.`));
    } else {
      if (item.subject !== skill.subject) issues.push(issue("skill_subject_mismatch", `itemBankItems.${i}.subject`, `Item ${item.id} subject ${String(item.subject)} does not match skill ${skill.subject}.`));
      if (item.gradeBand !== skill.gradeBand) issues.push(issue("skill_grade_mismatch", `itemBankItems.${i}.gradeBand`, `Item ${item.id} gradeBand ${String(item.gradeBand)} does not match skill ${skill.gradeBand}.`));
    }
    if (["multiple-choice", "multiple-select", "true-false"].includes(String(item.questionType))) {
      const choices = Array.isArray(item.choices) ? item.choices : [];
      if (choices.length < 2 || !choices.some((choice) => isObject(choice) && choice.isCorrect === true)) {
        issues.push(issue("schema_invalid", `itemBankItems.${i}.choices`, "Selected-response items require at least two choices and one correct answer."));
      }
    }
    if (["short-answer", "constructed-response"].includes(String(item.questionType)) && !isString(item.scoringRubric)) {
      issues.push(issue("schema_invalid", `itemBankItems.${i}.scoringRubric`, "Open-response items require a scoring rubric."));
    }
  }

  for (const [skillId, skill] of skills.entries()) {
    const prereqs = Array.isArray(skill.prerequisiteSkillIds) ? skill.prerequisiteSkillIds : [];
    for (const pre of prereqs) {
      if (typeof pre === "string" && !skills.has(pre)) issues.push(issue("unknown_skill", `skills.${skillId}.prerequisiteSkillIds`, `Skill ${skillId} references unknown prerequisite ${pre}.`));
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
    for (const pre of skill.prerequisiteSkillIds ?? []) visit(pre, [...path, skillId]);
    visiting.delete(skillId);
    visited.add(skillId);
  };
  for (const skillId of skills.keys()) visit(skillId, []);

  const packReviews = Array.isArray(pack.metadata.expertReviews) ? pack.metadata.expertReviews.filter(hasApprovedReview) : [];
  const roles = new Set(packReviews.map((review) => review.reviewerRole).filter(Boolean));
  if (!roles.has("sped_specialist")) issues.push(issue("missing_sped_review", "metadata.expertReviews", "K-8 curriculum pack requires SPED specialist approval before production import."));
  for (const subject of new Set([...skills.values()].map((s) => s.subject))) {
    const requiredRole = SUBJECT_REVIEW_ROLE[subject];
    if (!roles.has(requiredRole)) issues.push(issue("missing_subject_review", "metadata.expertReviews", `Curriculum pack includes ${subject}; requires ${requiredRole} approval.`));
  }

  return { ok: issues.length === 0, pack, issues };
}
