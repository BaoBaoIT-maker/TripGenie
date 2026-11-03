import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  userPreferenceService,
  UserPreference,
  UpdateUserPreferencePayload,
} from '@/services/user-preference.service';
import { toast } from 'sonner';

export const PREFERENCE_KEYS = {
  all: ['preferences'] as const,
  me: () => [...PREFERENCE_KEYS.all, 'me'] as const,
};

export function useUserPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: PREFERENCE_KEYS.me(),
    queryFn: () => userPreferenceService.getPreferences(),
    staleTime: 1000 * 60 * 10,
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateUserPreferencePayload) =>
      userPreferenceService.updatePreferences(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(PREFERENCE_KEYS.me(), updated);
      toast.success('Đã lưu sở thích du lịch thành công');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể lưu sở thích. Vui lòng thử lại.');
    },
  });
}
