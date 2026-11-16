import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsIn,
  IsArray,
  IsDateString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { PRICING_CONFIG } from '../../../config/pricing.config';
import { TIME_OF_DAY_REGEX } from '../../../common/utils/time-of-day.util';
import { WEATHER_THRESHOLDS } from '../../weather/weather.constants';

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

export interface TravelPaceFallbackSlot {
  start: string;
  end: string;
  dur: number;
  note: string;
}

export interface TravelPaceSpec {
  value: TravelPaceEnum;
  labelVi: string;
  minStopsPerDay: number;
  maxStopsPerDay: number;
  promptRule: string;
  fallbackSlots: ReadonlyArray<TravelPaceFallbackSlot>;
}

/** Single source of truth for TravelPace prompt constraints, candidate sizing, and deterministic fallback slots. */
export const TRAVEL_PACE_CONFIG: Readonly<
  Record<TravelPaceEnum, TravelPaceSpec>
> = {
  [TravelPaceEnum.RELAXED]: {
    value: TravelPaceEnum.RELAXED,
    labelVi: 'Thư thả',
    minStopsPerDay: 2,
    maxStopsPerDay: 3,
    promptRule:
      'Mức Thư thả (RELAXED): sắp xếp CHÍNH XÁC 2–3 hoạt động/ngày (ưu tiên nhịp chậm rãi, có khoảng nghỉ giữa các buổi, không chạy sô).',
    fallbackSlots: [
      {
        start: '09:00',
        end: '11:00',
        dur: 120,
        note: 'Tham quan thư thả buổi sáng',
      },
      {
        start: '11:45',
        end: '13:15',
        dur: 90,
        note: 'Ăn trưa đặc sản và nghỉ trưa',
      },
      {
        start: '15:30',
        end: '18:00',
        dur: 150,
        note: 'Dạo cảnh hoặc cà phê thư giãn buổi chiều',
      },
    ],
  },
  [TravelPaceEnum.BALANCED]: {
    value: TravelPaceEnum.BALANCED,
    labelVi: 'Cân bằng',
    minStopsPerDay: 4,
    maxStopsPerDay: 5,
    promptRule:
      'Mức Cân bằng (BALANCED): sắp xếp CHÍNH XÁC 4–5 hoạt động/ngày (hài hòa tham quan sáng/chiều, ăn trưa và dạo tối).',
    fallbackSlots: [
      { start: '08:30', end: '10:30', dur: 120, note: 'Khám phá buổi sáng' },
      { start: '11:30', end: '13:00', dur: 90, note: 'Ăn trưa đặc sản' },
      { start: '14:00', end: '16:30', dur: 150, note: 'Tham quan chiều' },
      {
        start: '18:30',
        end: '20:30',
        dur: 120,
        note: 'Dạo phố và ngắm cảnh đêm',
      },
    ],
  },
  [TravelPaceEnum.PACKED]: {
    value: TravelPaceEnum.PACKED,
    labelVi: 'Khám phá nhiều',
    minStopsPerDay: 6,
    maxStopsPerDay: 7,
    promptRule:
      'Mức Khám phá nhiều (PACKED): sắp xếp CHÍNH XÁC 6–7 hoạt động/ngày (tối ưu từ sáng sớm tới tối muộn, bổ sung café, check-in và ẩm thực tối hợp tuyến).',
    fallbackSlots: [
      {
        start: '07:30',
        end: '09:00',
        dur: 90,
        note: 'Đón bình minh & điểm tham quan sớm',
      },
      {
        start: '09:30',
        end: '11:15',
        dur: 105,
        note: 'Khám phá điểm nổi bật buổi sáng',
      },
      {
        start: '11:45',
        end: '13:00',
        dur: 75,
        note: 'Ăn trưa đặc sản địa phương',
      },
      {
        start: '13:45',
        end: '15:30',
        dur: 105,
        note: 'Tham quan & trải nghiệm buổi chiều',
      },
      {
        start: '16:00',
        end: '18:00',
        dur: 120,
        note: 'Cà phê check-in & ngắm hoàng hôn',
      },
      {
        start: '19:00',
        end: '21:00',
        dur: 120,
        note: 'Ăn tối, chợ đêm và dạo phố',
      },
    ],
  },
};

export function getTravelPaceSpec(pace?: string | null): TravelPaceSpec {
  if (pace && pace in TRAVEL_PACE_CONFIG) {
    return TRAVEL_PACE_CONFIG[pace as TravelPaceEnum];
  }
  return TRAVEL_PACE_CONFIG[TravelPaceEnum.BALANCED];
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
  @IsInt()
  @Min(PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE)
  @Max(PRICING_CONFIG.PARTY_SCALING.MAX_PARTY_SIZE)
  partySize?: number = PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE;

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
  @Matches(TOUR_BRIEFING_PHONE_REGEX, {
    message: 'Số điện thoại chỉ gồm chữ số và các ký tự + ( ) . -',
  })
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

export const ITINERARY_META_LIMITS = {
  MAX_TITLE_LENGTH: 160,
  MAX_DESCRIPTION_LENGTH: 600,
} as const;

export class UpdateItineraryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên lịch trình không được để trống.' })
  @MaxLength(ITINERARY_META_LIMITS.MAX_TITLE_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(ITINERARY_META_LIMITS.MAX_DESCRIPTION_LENGTH)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE)
  @Max(PRICING_CONFIG.PARTY_SCALING.MAX_PARTY_SIZE)
  partySize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate phải có định dạng YYYY-MM-DD',
  })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate phải có định dạng YYYY-MM-DD',
  })
  endDate?: string;

  @IsOptional()
  @IsIn(['merge', 'trim'], { message: 'dayShiftMode phải là merge hoặc trim' })
  dayShiftMode?: 'merge' | 'trim';
}

export class UpdatePartySizeDto extends UpdateItineraryDto {}

export const MOVE_DESTINATION_DIRECTIONS = ['UP', 'DOWN'] as const;

export class MoveDestinationDto {
  @IsIn(MOVE_DESTINATION_DIRECTIONS, {
    message: 'Hướng di chuyển chỉ có thể là UP hoặc DOWN.',
  })
  direction: (typeof MOVE_DESTINATION_DIRECTIONS)[number];
}

export const DESTINATION_LIMITS = {
  MAX_NOTES_LENGTH: 500,
} as const;

export class AddDestinationDto {
  @IsUUID()
  @IsNotEmpty()
  placeId: string;

  @IsInt()
  @Min(1)
  @Max(WEATHER_THRESHOLDS.MAX_TRIP_DAYS)
  dayNumber: number;

  @IsOptional()
  @IsString()
  timeSlot?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY_REGEX, {
    message: 'Giờ bắt đầu phải theo định dạng HH:mm',
  })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY_REGEX, {
    message: 'Giờ kết thúc phải theo định dạng HH:mm',
  })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESTINATION_LIMITS.MAX_NOTES_LENGTH)
  notes?: string;
}

export class UpdateDestinationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(WEATHER_THRESHOLDS.MAX_TRIP_DAYS)
  dayNumber?: number;

  @IsOptional()
  @Matches(TIME_OF_DAY_REGEX, {
    message: 'Giờ bắt đầu phải theo định dạng HH:mm',
  })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY_REGEX, {
    message: 'Giờ kết thúc phải theo định dạng HH:mm',
  })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESTINATION_LIMITS.MAX_NOTES_LENGTH)
  notes?: string;
}
