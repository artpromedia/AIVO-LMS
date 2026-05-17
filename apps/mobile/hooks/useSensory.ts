import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API } from '@/constants/api';

interface SensoryProfile {
  learnerId: string;
  visual: SensorySettings;
  auditory: SensorySettings;
  tactile: SensorySettings;
  vestibular: SensorySettings;
  lastUpdated: string;
}

interface SensorySettings {
  sensitivity: 'low' | 'moderate' | 'high';
  accommodations: string[];
  preferences: Record<string, unknown>;
}

export function useSensoryProfile(learnerId: string) {
  return useQuery<SensoryProfile>({
    queryKey: ['sensory', learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.BRAIN, `/api/brain/${learnerId}/sensory`);
      if (!res.ok) throw new Error('Failed to fetch sensory profile');
      return res.json();
    },
    enabled: !!learnerId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateSensory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      learnerId,
      updates,
    }: {
      learnerId: string;
      updates: Partial<SensoryProfile>;
    }) => {
      const res = await apiFetch(API.BRAIN, `/api/brain/${learnerId}/sensory`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update sensory profile');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sensory', variables.learnerId] });
    },
  });
}
