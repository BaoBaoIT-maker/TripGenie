import { apiClient } from '@/lib/api-client';

export interface CompanionMember {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
}

export interface PendingInvitation {
  id: string;
  inviteeEmail?: string | null;
  inviteeName?: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface CompanionsListResponse {
  members: CompanionMember[];
  pendingInvitations: PendingInvitation[];
}

export interface InvitationSummary {
  id: string;
  status: string;
  expiresAt: string;
  respondedAt: string | null;
  itinerary: {
    id: string;
    title: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
    coverPhoto: string | null;
  };
  inviter: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
}

export const tripCompanionService = {
  getCompanions: (itineraryId: string) =>
    apiClient<CompanionsListResponse>(`/itineraries/${itineraryId}/companions`),

  inviteCompanion: (itineraryId: string, email: string) =>
    apiClient<{ invitationId: string; status: string; expiresAt: string }>(
      `/itineraries/${itineraryId}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    ),

  updateMemberRole: (itineraryId: string, targetUserId: string, role: 'VIEWER' | 'EDITOR') =>
    apiClient<{ userId: string; role: 'VIEWER' | 'EDITOR' }>(
      `/itineraries/${itineraryId}/members/${targetUserId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      },
    ),

  removeMember: (itineraryId: string, targetUserId: string) =>
    apiClient<{ success: boolean; removedUserId: string }>(
      `/itineraries/${itineraryId}/members/${targetUserId}`,
      {
        method: 'DELETE',
      },
    ),

  leaveTrip: (itineraryId: string) =>
    apiClient<{ success: boolean; leftUserId: string }>(`/itineraries/${itineraryId}/leave`, {
      method: 'POST',
    }),

  getInvitation: (invitationId: string) =>
    apiClient<InvitationSummary>(`/trip-invitations/${invitationId}`),

  acceptInvitation: (invitationId: string) =>
    apiClient<{ itineraryId: string; role: 'VIEWER' }>(
      `/trip-invitations/${invitationId}/accept`,
      {
        method: 'POST',
      },
    ),

  declineInvitation: (invitationId: string) =>
    apiClient<{ success: boolean; status: string }>(
      `/trip-invitations/${invitationId}/decline`,
      {
        method: 'POST',
      },
    ),

  revokeInvitation: (invitationId: string) =>
    apiClient<{ success: boolean; status: string }>(
      `/trip-invitations/${invitationId}/revoke`,
      {
        method: 'POST',
      },
    ),
};
