/**
 * In-memory StandardsStore — wraps the standards / skill-graph Maps. Test-only;
 * the repo layer owns filtering/sorting + active-version/template selection.
 */
import { getStore } from "@/lib/db/store";
import type {
  AssessmentBlueprint,
  CurriculumImportJob,
  CurriculumMap,
  Domain,
  LessonObjectiveTemplate,
  SkillPrerequisite,
  SkillVersion,
  Standard,
  StandardDocument,
  StandardsFramework,
} from "@/lib/db/types";
import type { StandardsStore } from "../types";

export const memoryStandards: StandardsStore = {
  async listFrameworks(): Promise<StandardsFramework[]> {
    return Array.from(getStore().standardsFrameworks.values());
  },
  async getFramework(id) {
    return getStore().standardsFrameworks.get(id) ?? null;
  },
  async upsertFramework(f) {
    getStore().standardsFrameworks.set(f.id, f);
    return f;
  },
  async listStandardDocuments(): Promise<StandardDocument[]> {
    return Array.from(getStore().standardDocuments.values());
  },
  async listStandards(): Promise<Standard[]> {
    return Array.from(getStore().standards.values());
  },
  async getStandard(id) {
    return getStore().standards.get(id) ?? null;
  },
  async listDomains(): Promise<Domain[]> {
    return Array.from(getStore().domains.values());
  },
  async listSkillPrerequisites(): Promise<SkillPrerequisite[]> {
    return Array.from(getStore().skillPrerequisites.values());
  },
  async upsertSkillPrerequisite(p) {
    getStore().skillPrerequisites.set(p.id, p);
    return p;
  },
  async listSkillVersions(): Promise<SkillVersion[]> {
    return Array.from(getStore().skillVersions.values());
  },
  async upsertSkillVersion(v) {
    getStore().skillVersions.set(v.id, v);
    return v;
  },
  async listCurriculumMaps(): Promise<CurriculumMap[]> {
    return Array.from(getStore().curriculumMaps.values());
  },
  async upsertCurriculumMap(m) {
    getStore().curriculumMaps.set(m.id, m);
    return m;
  },
  async listLessonObjectiveTemplates(): Promise<LessonObjectiveTemplate[]> {
    return Array.from(getStore().lessonObjectiveTemplates.values());
  },
  async listAssessmentBlueprints(): Promise<AssessmentBlueprint[]> {
    return Array.from(getStore().assessmentBlueprints.values());
  },
  async listImportJobs(): Promise<CurriculumImportJob[]> {
    return Array.from(getStore().curriculumImportJobs.values());
  },
  async getImportJob(id) {
    return getStore().curriculumImportJobs.get(id) ?? null;
  },
  async upsertImportJob(j) {
    getStore().curriculumImportJobs.set(j.id, j);
    return j;
  },
};
