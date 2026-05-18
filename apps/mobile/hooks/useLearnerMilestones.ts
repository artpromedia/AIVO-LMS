import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface Milestone {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string;
}

export interface LearnerBadge {
  id: string;
  badgeKey: string;
  earnedAt: string;
}

export interface LearnerStreak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string | null;
}

export interface MilestonesResponse {
  milestones: Milestone[];
  badges: LearnerBadge[];
  streak: LearnerStreak;
}

export function useLearnerMilestones(learnerId: string) {
  return useQuery<MilestonesResponse>({
    queryKey: ["learner-milestones", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.FAMILY, `/api/family/milestones/${learnerId}`);
      if (!res.ok) throw new Error("Failed to load milestones");
      return res.json();
    },
    enabled: !!learnerId,
    staleTime: 60 * 1000,
  });
}
