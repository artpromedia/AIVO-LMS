/**
 * Build a learner's DAPE profile to enrich `brain_context` for Vigor sessions.
 *
 * The persona at services/ai-svc/src/ai_svc/prompts/tutor_personas.py says
 * Vigor should "switch to the DAPE track when the learner's brain profile
 * indicates active DAPE / motor IEP goals". That decision needs a structured
 * signal — inferring it from goal text inside the LLM prompt is brittle.
 *
 * This helper assembles a small `dape_profile` block that the prompt builder
 * consumes and renders as a deterministic instruction.
 */
import { eq } from "drizzle-orm";
import { iepGoals, iepProfiles, iepServices } from "@aivo/db";
import { buildDapeProfileSummary, type DapeProfileSummary } from "@aivo/scoring";

export async function loadDapeProfile(db: any, learnerId: string): Promise<DapeProfileSummary> {
  const goals = await db
    .select({ id: iepGoals.id, domain: iepGoals.domain, goalText: iepGoals.goalText })
    .from(iepGoals)
    .where(eq(iepGoals.learnerId, learnerId));

  // iep_services links to iep_profiles, not learners. Pull the active profile(s)
  // for this learner first; if none exist there's no service-driven DAPE signal.
  const profiles = await db
    .select({ id: iepProfiles.id })
    .from(iepProfiles)
    .where(eq(iepProfiles.learnerId, learnerId));

  let services: { serviceType: string | null }[] = [];
  for (const p of profiles) {
    const rows = await db
      .select({ serviceType: iepServices.serviceType })
      .from(iepServices)
      .where(eq(iepServices.iepProfileId, p.id));
    services = services.concat(rows);
  }

  return buildDapeProfileSummary(goals, services);
}
