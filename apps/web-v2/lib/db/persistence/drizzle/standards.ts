/**
 * Drizzle-backed StandardsStore — the web_* standards / skill-graph reference
 * tables. Plain row store keyed by id; filtering/sorting + active selection
 * live in the repo layer.
 */
import { eq } from "drizzle-orm";
import {
  webStandardsFrameworks,
  webStandardDocuments,
  webStandards,
  webDomains,
  webSkillPrerequisites,
  webSkillVersions,
  webCurriculumMaps,
  webLessonObjectiveTemplates,
  webAssessmentBlueprints,
  webBaselineBank,
  webCurriculumImportJobs,
} from "@aivo/db";
import type {
  AssessmentBlueprint,
  BaselineBankItem,
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
import { getDb } from "./client";

export const drizzleStandards: StandardsStore = {
  async listFrameworks(): Promise<StandardsFramework[]> {
    return (await getDb().select().from(webStandardsFrameworks)).map((r) => r.data as StandardsFramework);
  },
  async getFramework(id) {
    const [row] = await getDb()
      .select()
      .from(webStandardsFrameworks)
      .where(eq(webStandardsFrameworks.id, id))
      .limit(1);
    return row ? (row.data as StandardsFramework) : null;
  },
  async upsertFramework(f) {
    await getDb()
      .insert(webStandardsFrameworks)
      .values({ id: f.id, data: f })
      .onConflictDoUpdate({ target: webStandardsFrameworks.id, set: { data: f } });
    return f;
  },
  async listStandardDocuments(): Promise<StandardDocument[]> {
    return (await getDb().select().from(webStandardDocuments)).map((r) => r.data as StandardDocument);
  },
  async listStandards(): Promise<Standard[]> {
    return (await getDb().select().from(webStandards)).map((r) => r.data as Standard);
  },
  async getStandard(id) {
    const [row] = await getDb().select().from(webStandards).where(eq(webStandards.id, id)).limit(1);
    return row ? (row.data as Standard) : null;
  },
  async listDomains(): Promise<Domain[]> {
    return (await getDb().select().from(webDomains)).map((r) => r.data as Domain);
  },
  async listSkillPrerequisites(): Promise<SkillPrerequisite[]> {
    return (await getDb().select().from(webSkillPrerequisites)).map((r) => r.data as SkillPrerequisite);
  },
  async upsertSkillPrerequisite(p) {
    await getDb()
      .insert(webSkillPrerequisites)
      .values({ id: p.id, data: p })
      .onConflictDoUpdate({ target: webSkillPrerequisites.id, set: { data: p } });
    return p;
  },
  async listSkillVersions(): Promise<SkillVersion[]> {
    return (await getDb().select().from(webSkillVersions)).map((r) => r.data as SkillVersion);
  },
  async upsertSkillVersion(v) {
    await getDb()
      .insert(webSkillVersions)
      .values({ id: v.id, data: v })
      .onConflictDoUpdate({ target: webSkillVersions.id, set: { data: v } });
    return v;
  },
  async listCurriculumMaps(): Promise<CurriculumMap[]> {
    return (await getDb().select().from(webCurriculumMaps)).map((r) => r.data as CurriculumMap);
  },
  async upsertCurriculumMap(m) {
    await getDb()
      .insert(webCurriculumMaps)
      .values({ id: m.id, data: m })
      .onConflictDoUpdate({ target: webCurriculumMaps.id, set: { data: m } });
    return m;
  },
  async listLessonObjectiveTemplates(): Promise<LessonObjectiveTemplate[]> {
    return (await getDb().select().from(webLessonObjectiveTemplates)).map(
      (r) => r.data as LessonObjectiveTemplate,
    );
  },
  async listAssessmentBlueprints(): Promise<AssessmentBlueprint[]> {
    return (await getDb().select().from(webAssessmentBlueprints)).map(
      (r) => r.data as AssessmentBlueprint,
    );
  },
  async listBaselineBankItems(): Promise<BaselineBankItem[]> {
    return (await getDb().select().from(webBaselineBank)).map((r) => r.data as BaselineBankItem);
  },
  async listImportJobs(): Promise<CurriculumImportJob[]> {
    return (await getDb().select().from(webCurriculumImportJobs)).map(
      (r) => r.data as CurriculumImportJob,
    );
  },
  async getImportJob(id) {
    const [row] = await getDb()
      .select()
      .from(webCurriculumImportJobs)
      .where(eq(webCurriculumImportJobs.id, id))
      .limit(1);
    return row ? (row.data as CurriculumImportJob) : null;
  },
  async upsertImportJob(j) {
    await getDb()
      .insert(webCurriculumImportJobs)
      .values({ id: j.id, data: j })
      .onConflictDoUpdate({ target: webCurriculumImportJobs.id, set: { data: j } });
    return j;
  },
};
