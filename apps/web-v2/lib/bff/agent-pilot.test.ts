/**
 * Remediation Sprint 10 — the per-tutor agent EVAL gate.
 *
 * The roster maps every subject to a fronting tutor, but an agent session
 * may only open for tutors that passed the REAL-MODEL evaluation
 * (AGENT_ENABLED_TUTORS, enforced repo-wide by `pnpm agent:eval`). With no
 * recorded eval, the list is empty and NO subject gets an agent — the
 * honest default until real scores land.
 */
import { describe, expect, it } from "vitest";
import {
  AGENT_ENABLED_TUTORS,
  PILOT_SUBJECT_TUTORS,
  agentForSubjectSlug,
  isAgentEnabledForTutor,
} from "./agent-pilot";

describe("agent eval gate", () => {
  it("keeps the full 14-tutor roster intact (the WHO is unchanged)", () => {
    expect(new Set(Object.values(PILOT_SUBJECT_TUTORS)).size).toBe(14);
  });

  it("opens an agent only for eval-passed tutors", () => {
    for (const [slug, tutorKey] of Object.entries(PILOT_SUBJECT_TUTORS)) {
      const agent = agentForSubjectSlug(slug);
      if (isAgentEnabledForTutor(tutorKey)) {
        expect(agent?.tutorKey).toBe(tutorKey);
      } else {
        expect(agent, `${slug} must not get an agent before ${tutorKey} passes eval`).toBeNull();
      }
    }
  });

  it("ships disabled until a keyed real-model eval records passing scores", () => {
    // This assertion is intentionally about the CURRENT committed state: the
    // scorecard has no entries, so nothing may be enabled. When a real eval
    // run lands scores and a tutor is added to AGENT_ENABLED_TUTORS, update
    // this test alongside the scorecard — `pnpm agent:eval` cross-checks the
    // pair either way.
    expect(AGENT_ENABLED_TUTORS).toHaveLength(0);
    expect(agentForSubjectSlug("math")).toBeNull();
  });
});
