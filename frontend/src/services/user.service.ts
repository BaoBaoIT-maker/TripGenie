import { apiClient } from '@/lib/api-client';
import { AuthUser } from '@/types/auth';

export const userService = {
  async updateAvatar(avatarUrl: string): Promise<{ message: string; user: AuthUser }> {
    return apiClient<{ message: string; user: AuthUser }>('/users/me/avatar', {
      method: 'PATCH',
      body: JSON.stringify({ avatarUrl }),
    });
  },

  async updateUsername(username: string): Promise<{ message: string; user: AuthUser }> {
    return apiClient<{ message: string; user: AuthUser }>('/users/me/username', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  },
};
