import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsDateString,
  MaxLength,
  Matches,
} from 'class-validator';

export enum TransitModeEnum {
  FLIGHT = 'FLIGHT',
  SLEEPER_BUS = 'SLEEPER_BUS',
  TRAIN = 'TRAIN',
  PERSONAL_CAR = 'PERSONAL_CAR',
  PERSONAL_MOTORBIKE = 'PERSONAL_MOTORBIKE',
}

export enum IntracityModeEnum {
  MOTORBIKE_RENTAL = 'MOTORBIKE_RENTAL',
  GRAB_BIKE = 'GRAB_BIKE',
  TAXI_CAR = 'TAXI_CAR',
}

export enum BudgetLevelEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  LUXURY = 'LUXURY',
}

export enum TravelPaceEnum {
  RELAXED = 'RELAXED', // 2-3 stops/day
  BALANCED = 'BALANCED', // 4-5 stops/day
  PACKED = 'PACKED', // 6-7 stops/day
}

export class GenerateItineraryDto {
  @IsString()
  @IsNotEmpty()
  originCity: string;

  @IsOptional()
  @IsNumber()
  originLat?: number;

  @IsOptional()
  @IsNumber()
  originLng?: number;

  @IsString()
  @IsNotEmpty()
  destinationCity: string;

  @IsOptional()
  @IsNumber()
  destinationAreaId?: number;

  @IsOptional()
  @IsNumber()
  destinationLat?: number;

  @IsOptional()
  @IsNumber()
  destinationLng?: number;

  @IsString()
  @IsNotEmpty()
  startDate: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  endDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsEnum(BudgetLevelEnum)
  budgetLevel?: BudgetLevelEnum = BudgetLevelEnum.MEDIUM;

  @IsOptional()
  @IsEnum(TransitModeEnum)
  transitMode?: TransitModeEnum;

  @IsOptional()
  @IsEnum(IntracityModeEnum)
  intracityMode?: IntracityModeEnum = IntracityModeEnum.MOTORBIKE_RENTAL;

  @IsOptional()
  @IsEnum(TravelPaceEnum)
  pace?: TravelPaceEnum = TravelPaceEnum.BALANCED;

  @IsOptional()
  @IsArray()
  travelStyles?: string[] = ['CULTURE', 'FOOD', 'SIGHTSEEING'];

  @IsOptional()
  @IsString()
  customPrompt?: string;
}

/** Body of POST /itineraries/transit-preview (validated at the trust boundary). */
export class TransitPreviewDto {
  @IsString() @IsNotEmpty() originCity: string;
  @IsOptional() @IsNumber() originLat?: number;
  @IsOptional() @IsNumber() originLng?: number;
  @IsString() @IsNotEmpty() destCity: string;
  @IsOptional() @IsNumber() destLat?: number;
  @IsOptional() @IsNumber() destLng?: number;
  @IsOptional() @IsEnum(TransitModeEnum) transitMode?: TransitModeEnum;
  @IsOptional() @IsEnum(BudgetLevelEnum) budgetLevel?: BudgetLevelEnum;
  @IsDateString() departDate: string; // YYYY-MM-DD
  @IsOptional() @IsDateString() returnDate?: string;
}

export class BulkDeleteItinerariesDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

export class UpdateTransitModeDto {
  @IsEnum(TransitModeEnum)
  @IsNotEmpty()
  transitMode: TransitModeEnum;
}

export class UpdateCoverPhotoDto {
  @IsString()
  @IsNotEmpty()
  coverPhoto: string;
}


export const TOUR_BRIEFING_LIMITS = {
  MAX_LEADER_NAME_LENGTH: 100,
  MAX_LEADER_PHONE_LENGTH: 30,
  MAX_MEETING_POINT_LENGTH: 250,
  MAX_NOTES_LENGTH: 600,
} as const;

/** Digits plus common phone separators only (empty string clears the field). */
export const TOUR_BRIEFING_PHONE_REGEX = /^[0-9+().\-\s]*$/;

export class UpdateTourBriefingDto {
  @IsOptional()
  @IsString()
  @MaxLength(TOUR_BRIEFING_LIMITS.MAX_LEADER_NAME_LENGTH)
  leaderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TOUR_BRIEFING_LIMITS.MAX_LEADER_PHONE_LENGTH)
  @Matches(TOUR_BRIEFING_PHONE_REGEX, { message: 'Số điện thoại chỉ gồm chữ số và các ký tự + ( ) . -' })
  leaderPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TOUR_BRIEFING_LIMITS.MAX_MEETING_POINT_LENGTH)
  meetingPoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TOUR_BRIEFING_LIMITS.MAX_NOTES_LENGTH)
  notes?: string;
}
