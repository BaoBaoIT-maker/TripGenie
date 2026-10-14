import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ADVISOR_CONSTANTS } from './advisor.constants';

export class AdvisorChatDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống.' })
  @MaxLength(ADVISOR_CONSTANTS.MAX_MESSAGE_LENGTH, {
    message: `Tin nhắn tối đa ${ADVISOR_CONSTANTS.MAX_MESSAGE_LENGTH} ký tự.`,
  })
  message: string;

  @IsOptional()
  @IsUUID('4', { message: 'Mã phiên trò chuyện không hợp lệ.' })
  sessionId?: string;
}

export interface AdvisorPlaceSummary {
  id: string;
  name: string;
  address: string;
  city: string;
  categoryName: string;
  ratingAvg: number;
  reviewCount: number;
  priceLevel: string | null;
  primaryImage: string | null;
  latitude: number;
  longitude: number;
}

export interface AdvisorCitation {
  documentTitle: string;
  breadcrumbs: string;
  confidence: 'HIGH' | 'LOW';
  similarityScore: number;
}

export interface AdvisorChatResponse {
  sessionId: string;
  reply: string;
  places: AdvisorPlaceSummary[];
  citations: AdvisorCitation[];
}

export interface AdvisorSessionSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: Date;
}

export interface AdvisorMessageHistoryItem {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  places?: AdvisorPlaceSummary[];
  citations?: AdvisorCitation[];
  createdAt: Date;
}

export interface ToolExecutionOutcome {
  toolResponsePayload: Record<string, unknown>;
  discoveredPlaces: AdvisorPlaceSummary[];
  discoveredCitations: AdvisorCitation[];
}
