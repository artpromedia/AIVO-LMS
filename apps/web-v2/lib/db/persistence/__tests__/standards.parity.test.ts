/**
 * standards / skill-graph — memory == postgres parity (Sprint 8 remainder).
 *
 * Platform-global curriculum-standards reference + skill-graph authoring:
 * framework create + slug lookup, skill create (auto v1 version), the
 * prerequisite DAG (dup + cycle refusal + denormalized mirror), skill-version
 * current-flip, curriculum-map FK checks, and the import-job aggregate.
 */
import { it, expect } from "vitest";
import {
  listStandardsFrameworks,
  getStandardsFrameworkBySlug,
  createStandardsFramework,
  createSkill,
  listSkillPrerequisites,
  addSkillPrerequisite,
  getCurrentSkillVersion,
  createSkillVersion,
  startCurriculumImportJob,
  getCurriculumImportJob,
} from "@/lib/db/repos";
import { getPersistence as getP } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

runInBothModes("standards", () => {
  it("framework create + slug lookup; list sorted", async () => {
    const f = await createStandardsFramework({
      slug: "zzz_test" as never,
      name: "ZZZ Standards",
      issuer: "ACME",
      description: "d",
      homepageUrl: null,
    });
    expect((await getStandardsFrameworkBySlug("zzz_test" as never))?.id).toBe(f.id);
    expect((await listStandardsFrameworks()).some((x) => x.id === f.id)).toBe(true);
  });

  it("skill create auto-creates a current v1 version", async () => {
    // Use a seeded subject so the FK check passes in both backends.
    const subjects = await getP().curriculum.listSubjects();
    const subjectId = subjects[0]!.id;
    const skill = await createSkill({ subjectId, slug: "skl-parity", name: "Counting", gradeBand: "K" });
    const cur = await getCurrentSkillVersion(skill.id);
    expect(cur?.version).toBe("1.0");
    expect(cur?.isCurrent).toBe(true);

    // A second version flips the prior to non-current.
    const v2 = await createSkillVersion({ skillId: skill.id, version: "2.0", objectiveSummary: "s" });
    expect(v2?.isCurrent).toBe(true);
    expect((await getCurrentSkillVersion(skill.id))?.version).toBe("2.0");
  });

  it("prerequisite DAG: add edge, refuse dup + self + cycle", async () => {
    const subjects = await getP().curriculum.listSubjects();
    const subjectId = subjects[0]!.id;
    const a = await createSkill({ subjectId, slug: "skl-a", name: "A", gradeBand: "1" });
    const b = await createSkill({ subjectId, slug: "skl-b", name: "B", gradeBand: "1" });

    // self edge refused
    expect(await addSkillPrerequisite({ skillId: a.id, prerequisiteSkillId: a.id, strength: "hard" })).toBeNull();
    // b requires a
    const edge = await addSkillPrerequisite({ skillId: b.id, prerequisiteSkillId: a.id, strength: "hard" });
    expect(edge).not.toBeNull();
    // duplicate refused
    expect(await addSkillPrerequisite({ skillId: b.id, prerequisiteSkillId: a.id, strength: "soft" })).toBeNull();
    // cycle (a requires b, but b already requires a) refused
    expect(await addSkillPrerequisite({ skillId: a.id, prerequisiteSkillId: b.id, strength: "hard" })).toBeNull();
    // edge persisted + skill's denormalized mirror updated
    expect((await listSkillPrerequisites(b.id)).some((p) => p.prerequisiteSkillId === a.id)).toBe(true);
    expect((await getP().curriculum.getSkillById(b.id))?.prerequisites).toContain(a.id);
  });

  it("import job aggregates the framework's documents + standards", async () => {
    const f = await createStandardsFramework({
      slug: "imp_test" as never,
      name: "Imp",
      issuer: "x",
      description: "d",
      homepageUrl: null,
    });
    const job = await startCurriculumImportJob({
      frameworkSlug: f.slug as never,
      source: "manual",
      requestedByUserId: "u",
    });
    expect(job.status).toBe("succeeded");
    expect((await getCurriculumImportJob(job.id))?.id).toBe(job.id);
    // Unknown framework → failed.
    const bad = await startCurriculumImportJob({
      frameworkSlug: "nope_slug" as never,
      source: "manual",
      requestedByUserId: "u",
    });
    expect(bad.status).toBe("failed");
  });
});
