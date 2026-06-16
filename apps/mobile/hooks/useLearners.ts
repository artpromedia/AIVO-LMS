import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

interface Learner {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  avatar?: string;
  functioningLevel: string;
  pin?: string;
  createdAt: string;
}

export function useLearners() {
  return useQuery<Learner[]>({
    queryKey: ["learners"],
    queryFn: async () => {
      const res = await apiFetch(API.IDENTITY, "/api/users/learners");
      if (!res.ok) throw new Error("Failed to fetch learners");
      return res.json();
    },
  });
}

export function useLearner(learnerId: string) {
  return useQuery<Learner>({
    queryKey: ["learners", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.IDENTITY, `/api/users/learners/${learnerId}`);
      if (!res.ok) throw new Error("Failed to fetch learner");
      return res.json();
    },
    enabled: !!learnerId,
  });
}

export interface AddLearnerInput {
  firstName: string;
  lastName: string;
  gradeLevel: string;
  pin: string;
  dateOfBirth?: string;
  preferredLanguage?: string;
}

/**
 * Build the identity-svc `POST /api/users/learners` request body from the
 * fields the mobile form collects.
 *
 * identity-svc requires a single `name` (it has no firstName/lastName), so we
 * compose it here. When a `preferredLanguage` is supplied, identity-svc
 * persists it into language_profiles — the record brain-svc surfaces and the
 * AI tutors read to deliver in the learner's language. The language is omitted
 * when blank so we never write an empty profile.
 */
export function buildLearnerCreateBody(data: AddLearnerInput): Record<string, unknown> {
  const name = [data.firstName, data.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const body: Record<string, unknown> = {
    name,
    gradeLevel: data.gradeLevel,
    pin: data.pin,
  };
  if (data.dateOfBirth) body.dateOfBirth = data.dateOfBirth;
  const preferredLanguage = data.preferredLanguage?.trim();
  if (preferredLanguage) body.preferredLanguage = preferredLanguage;
  return body;
}

export function useAddLearner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddLearnerInput) => {
      const res = await apiFetch(API.IDENTITY, "/api/users/learners", {
        method: "POST",
        body: JSON.stringify(buildLearnerCreateBody(data)),
      });
      if (!res.ok) throw new Error("Failed to add learner");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learners"] });
    },
  });
}
