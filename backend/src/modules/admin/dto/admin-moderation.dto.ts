import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PostModerationStatus, ReportStatus, ReportType } from '@prisma/client';
import { ADMIN_CONSTANTS } from '../admin.constants';

export class AdminUpdateModerationConfigDto {
  @IsBoolean()
  aiModerationEnabled: boolean;
}

export class QueryAdminModerationPostsDto {
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
  @IsEnum(PostModerationStatus)
  status?: PostModerationStatus;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim().toUpperCase()).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
        .split(',')
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean);
    }
    return undefined;
  })
  @IsArray()
  @IsEnum(PostModerationStatus, { each: true })
  statuses?: PostModerationStatus[];

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminModeratePostDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_REASON_LENGTH)
  reason?: string;
}

export class QueryAdminReportsDto {
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
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  highPriorityOnly?: boolean;
}

export class AdminResolveReportDto {
  @IsString()
  @IsIn(['RESOLVE', 'DISMISS'])
  action: 'RESOLVE' | 'DISMISS';

  @IsOptional()
  @IsString()
  @MaxLength(ADMIN_CONSTANTS.VALIDATION.MAX_REASON_LENGTH)
  resolutionNote?: string;

  @IsOptional()
  @IsBoolean()
  rejectTargetPost?: boolean;
}
