import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BudgetLevel, PlaceStatus } from '@prisma/client';
import { ADMIN_CONSTANTS } from '../admin.constants';

export class QueryAdminPlacesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_CONSTANTS.PAGINATION.MAX_LIMIT)
  limit?: number = ADMIN_CONSTANTS.PAGINATION.DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  areaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsEnum(PlaceStatus)
  status?: PlaceStatus;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  includeDeleted?: boolean;
}

export class AdminCreatePlaceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(ADMIN_CONSTANTS.VALIDATION.MIN_PLACE_NAME_LENGTH)
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_PLACE_NAME_LENGTH)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_ADDRESS_LENGTH)
  address: string;

  @Type(() => Number)
  @IsNumber()
  @Min(ADMIN_CONSTANTS.COORDINATES.MIN_LAT)
  @Max(ADMIN_CONSTANTS.COORDINATES.MAX_LAT)
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(ADMIN_CONSTANTS.COORDINATES.MIN_LNG)
  @Max(ADMIN_CONSTANTS.COORDINATES.MAX_LNG)
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  areaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsEnum(BudgetLevel)
  priceLevel?: BudgetLevel;

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_PHONE_LENGTH)
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsEnum(PlaceStatus)
  status?: PlaceStatus;
}

export class AdminUpdatePlaceDto {
  @IsOptional()
  @IsString()
  @MinLength(ADMIN_CONSTANTS.VALIDATION.MIN_PLACE_NAME_LENGTH)
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_PLACE_NAME_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_ADDRESS_LENGTH)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(ADMIN_CONSTANTS.COORDINATES.MIN_LAT)
  @Max(ADMIN_CONSTANTS.COORDINATES.MAX_LAT)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(ADMIN_CONSTANTS.COORDINATES.MIN_LNG)
  @Max(ADMIN_CONSTANTS.COORDINATES.MAX_LNG)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  areaId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number | null;

  @IsOptional()
  @IsEnum(BudgetLevel)
  priceLevel?: BudgetLevel | null;

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_PHONE_LENGTH)
  phone?: string | null;

  @IsOptional()
  @IsString()
  website?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsEnum(PlaceStatus)
  status?: PlaceStatus;
}
