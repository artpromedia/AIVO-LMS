import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

interface EngagementProfile {
  userId: string;
  xp: number;
  level: number;
  coins: number;
  gems: number;
  streakDays: number;
  streakFrozen: boolean;
  badges: Badge[];
  activeChallenges: Challenge[];
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  earnedAt: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: "daily" | "weekly" | "multiplayer";
  progress: number;
  target: number;
  reward: { xp: number; coins: number };
}

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
