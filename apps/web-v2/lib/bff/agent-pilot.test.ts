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

  it("every enabled tutor is either eval-passed or covered by the recorded owner decision", () => {
    // Owner decision (2026-06-12): the full roster is enabled — the keyed
    // live server runs the real-model eval and commits the scorecard. A
    // recorded FAILURE still blocks (pnpm agent:eval); this test pins the
    // consistency triangle between the enabled list, the roster, and the
    // scorecard's waiver/entries.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const scorecard = require("../../../../docs/quality/agent-eval-scorecard.json") as {
      ownerEnabledWithoutEval?: { date?: string; by?: string };
      tutors: Record<string, { status?: string; hardFail?: boolean }>;
    };
    const rosterTutors = new Set(Object.values(PILOT_SUBJECT_TUTORS));
    expect(AGENT_ENABLED_TUTORS.length).toBeGreaterThan(0);
    for (const tutorKey of AGENT_ENABLED_TUTORS) {
      expect(rosterTutors.has(tutorKey), `${tutorKey} must front a subject`).toBe(true);
      const entry = scorecard.tutors[tutorKey];
      if (entry) {
        expect(entry.status, `${tutorKey} has a recorded eval`).toBe("passed");
        expect(entry.hardFail ?? false).toBe(false);
      } else {
        expect(
          Boolean(scorecard.ownerEnabledWithoutEval?.date),
          `${tutorKey} enabled without eval requires the recorded owner decision`,
        ).toBe(true);
      }
    }
    // And the enablement actually reaches lessons: math gets its agent.
    expect(agentForSubjectSlug("math")?.tutorKey).toBe("nova");
  });
});
