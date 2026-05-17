/**
 * Records each beat outcome to the problem-session-svc ledger. Sprint 06
 * (recommendation pipeline) reads these to derive profile recommendations.
 */

import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import type { ProblemSessionRecord } from "@/src/types/problemSession";

export const problemSessionClient = {
  async record(entry: ProblemSessionRecord): Promise<void> {
    const base = (API as Record<string, string>).PROBLEM_SESSION ?? API.LEARNING;
    const res = await apiFetch(base, "/api/problem-session/records", {
      method: "POST",
      body: JSON.stringify(entry),
    });
    if (!res.ok && res.status !== 404) {
      // 404 means the ledger service isn't wired yet in this environment;
      // not a learner-facing error.
      throw new Error(`problem-session record failed: ${res.status}`);
    }
  },
};
