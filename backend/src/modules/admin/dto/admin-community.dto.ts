import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ADMIN_CONSTANTS } from '../admin.constants';

export class QueryAdminCommunityGroupsDto {
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
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  includeDeleted?: boolean;
}

export class AdminCreateCommunityGroupDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(ADMIN_CONSTANTS.VALIDATION.MIN_GROUP_NAME_LENGTH)
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_NAME_LENGTH)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_SLUG_LENGTH)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_SUBTITLE_LENGTH)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_DESCRIPTION_LENGTH)
  description?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateCommunityGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(ADMIN_CONSTANTS.VALIDATION.MIN_GROUP_NAME_LENGTH)
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_NAME_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_SLUG_LENGTH)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_SUBTITLE_LENGTH)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_DESCRIPTION_LENGTH)
  description?: string | null;

  @IsOptional()
  @IsString()
  iconUrl?: string | null;

  @IsOptional()
  @IsString()
  coverUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
