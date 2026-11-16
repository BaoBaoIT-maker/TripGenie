'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user.service';
import { AuthUser } from '@/types/auth';

export interface UpdateProfileParams {
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileParams) => userService.updateProfile(data),
    onSuccess: (data) => {
      queryClient.setQueryData<AuthUser | null>(['auth', 'me'], (prev) => {
        if (!prev) return null;
        return {
          ...prev,
          fullName: data.user?.fullName ?? prev.fullName,
          bio: data.user?.bio ?? prev.bio,
          avatarUrl: data.user?.avatarUrl ?? prev.avatarUrl,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
