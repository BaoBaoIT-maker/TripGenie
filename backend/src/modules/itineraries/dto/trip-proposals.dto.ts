import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { ProposalStatus } from '@prisma/client';
import { WEATHER_THRESHOLDS } from '../../weather/weather.constants';
import { TIME_OF_DAY_REGEX } from '../../../common/utils/time-of-day.util';
import {
  PROPOSAL_LIMITS,
  PROPOSAL_RESOLVE_ACTIONS,
  type ProposalResolveAction,
} from '../trip-companions.constants';

export class CreateGroupProposalDto {
  @IsUUID(undefined, { message: 'placeId phải là UUID hợp lệ' })
  placeId: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'destinationId phải là UUID hợp lệ' })
  destinationId?: string;

  @IsOptional()
  @IsInt({ message: 'dayNumber phải là số nguyên' })
  @Min(PROPOSAL_LIMITS.MIN_DAY_NUMBER)
  @Max(WEATHER_THRESHOLDS.MAX_TRIP_DAYS)
  dayNumber?: number;

  @IsOptional()
  @Matches(TIME_OF_DAY_REGEX, {
    message: 'proposedStartTime phải theo định dạng HH:mm',
  })
  proposedStartTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PROPOSAL_LIMITS.MAX_NOTES_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}

export class ResolveGroupProposalDto {
  @IsIn(PROPOSAL_RESOLVE_ACTIONS, {
    message: 'Hành động xử lý chỉ hỗ trợ APPROVE hoặc REJECT',
  })
  action: ProposalResolveAction;
}

export interface GroupProposalParticipantDto {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface GroupProposalPlaceDto {
  id: string;
  name: string;
  address: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  ratingAvg: number | null;
}

export interface GroupProposalItemDto {
  id: string;
  tripGroupId: string;
  placeId: string;
  destinationId: string | null;
  dayNumber: number;
  proposedStartTime: string | null;
  notes: string | null;
  status: ProposalStatus;
  proposedBy: string;
  proposer: GroupProposalParticipantDto;
  place: GroupProposalPlaceDto;
  voteCount: number;
  hasVoted: boolean;
  voters: GroupProposalParticipantDto[];
  createdAt: string;
}

export interface GroupProposalsListResponseDto {
  proposals: GroupProposalItemDto[];
}

export interface ToggleProposalVoteResponseDto {
  proposalId: string;
  voted: boolean;
  voteCount: number;
  proposal: GroupProposalItemDto;
}

export interface ResolveGroupProposalResponseDto {
  proposal: GroupProposalItemDto;
  itinerary?: unknown;
}
