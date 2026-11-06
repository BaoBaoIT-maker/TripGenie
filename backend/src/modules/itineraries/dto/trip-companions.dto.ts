import { IsEmail, IsNotEmpty, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class InviteCompanionDto {
  @IsEmail({}, { message: 'Email người nhận không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;
}

export class UpdateMemberRoleDto {
  @IsIn(['VIEWER', 'EDITOR'], { message: 'Quyền thành viên chỉ có thể là VIEWER hoặc EDITOR' })
  role: 'VIEWER' | 'EDITOR';
}

export interface CompanionMemberDto {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
}

export interface PendingInvitationDto {
  id: string;
  inviteeEmail?: string | null;
  inviteeName?: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface CompanionsListResponseDto {
  members: CompanionMemberDto[];
  pendingInvitations: PendingInvitationDto[];
}

export interface InvitationSummaryDto {
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

export interface AcceptInvitationResponseDto {
  itineraryId: string;
  role: 'VIEWER';
}
