import { apiClient } from '@/lib/api-client';

export type BudgetLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'LUXURY';

export interface UserPreference {
  id: string;
  userId: string;
  budgetLevel: BudgetLevel;
  travelStyle: string[];
  preferredCategories: string[];
  dietaryRestrictions: string[];
  updatedAt: string;
}

export interface UpdateUserPreferencePayload {
  budgetLevel?: BudgetLevel;
  travelStyle?: string[];
  preferredCategories?: string[];
  dietaryRestrictions?: string[];
}

export const userPreferenceService = {
  async getPreferences(): Promise<UserPreference> {
    const res = await apiClient<{ preferences: UserPreference }>('/users/me/preferences');
    return res.preferences;
  },

  async updatePreferences(
    payload: UpdateUserPreferencePayload,
  ): Promise<UserPreference> {
    const res = await apiClient<{ preferences: UserPreference }>('/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.preferences;
  },
};
