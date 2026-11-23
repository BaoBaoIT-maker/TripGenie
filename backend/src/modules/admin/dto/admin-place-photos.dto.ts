import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlaceImageStatus } from '@prisma/client';
import { ADMIN_CONSTANTS } from '../admin.constants';

export class QueryAdminPlacePhotosDto {
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
  @IsEnum(PlaceImageStatus)
  status?: PlaceImageStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminApprovePlacePhotoDto {
  @IsOptional()
  @IsBoolean()
  setAsPrimary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_NOTES_LENGTH)
  note?: string;
}

export class AdminRejectPlacePhotoDto {
  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_REASON_LENGTH)
  reason?: string;
}
