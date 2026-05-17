import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API } from '@/constants/api';

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
    queryKey: ['learners'],
    queryFn: async () => {
      const res = await apiFetch(API.IDENTITY, '/api/users/learners');
      if (!res.ok) throw new Error('Failed to fetch learners');
      return res.json();
    },
  });
}

export function useLearner(learnerId: string) {
  return useQuery<Learner>({
    queryKey: ['learners', learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.IDENTITY, `/api/users/learners/${learnerId}`);
      if (!res.ok) throw new Error('Failed to fetch learner');
      return res.json();
    },
    enabled: !!learnerId,
  });
}

export function useAddLearner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      gradeLevel: string;
      pin: string;
      dateOfBirth?: string;
    }) => {
      const res = await apiFetch(API.IDENTITY, '/api/users/learners', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add learner');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learners'] });
    },
  });
}
