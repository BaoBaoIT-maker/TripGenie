'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user.service';
import { AuthUser } from '@/types/auth';

export function useUpdateAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (avatarUrl: string) => userService.updateAvatar(avatarUrl),
    onSuccess: (data) => {
      queryClient.setQueryData<AuthUser | null>(['auth', 'me'], (prev) => {
        if (!prev) return null;
        return {
          ...prev,
          avatarUrl: data.user?.avatarUrl || prev.avatarUrl,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
