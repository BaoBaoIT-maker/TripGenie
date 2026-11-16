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

export interface AdminRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class QueryAdminUsersDto {
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
}

export class AdminBanUserDto {
  @IsString()
  @IsNotEmpty({ message: ADMIN_CONSTANTS.MESSAGES.REASON_REQUIRED })
  @MinLength(ADMIN_CONSTANTS.VALIDATION.MIN_REASON_LENGTH, {
    message: ADMIN_CONSTANTS.MESSAGES.REASON_MIN_LENGTH,
  })
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_REASON_LENGTH, {
    message: ADMIN_CONSTANTS.MESSAGES.REASON_MAX_LENGTH,
  })
  reason: string;
}

export class AdminPromoteUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_NOTES_LENGTH)
  notes?: string;
}
