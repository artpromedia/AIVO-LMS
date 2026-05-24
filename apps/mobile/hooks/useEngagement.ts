import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import type {
  EngagementBadge as Badge,
  EngagementChallenge as Challenge,
  EngagementProfile,
} from "@/src/contracts/engagement";

export type { EngagementProfile, Badge, Challenge };

export function useEngagement(userId: string) {
  return useQuery<EngagementProfile>({
    queryKey: ["engagement", userId],
    queryFn: async () => {
      const res = await apiFetch(API.ENGAGEMENT, `/api/engagement/profile/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch engagement");
      return res.json();
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function useLeaderboard(scope: "class" | "school" | "global" = "global") {
  return useQuery({
    queryKey: ["leaderboard", scope],
    queryFn: async () => {
      const res = await apiFetch(API.ENGAGEMENT, `/api/engagement/leaderboard/${scope}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });
}
