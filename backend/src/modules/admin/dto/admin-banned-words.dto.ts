import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BannedWordAction, BannedWordCategory } from '@prisma/client';
import { ADMIN_CONSTANTS } from '../admin.constants';

export class CreateBannedWordDto {
  @IsString()
  @MinLength(2, { message: 'Từ khóa cấm phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Từ khóa cấm không được vượt quá 100 ký tự' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  word: string;

  @IsEnum(BannedWordCategory, {
    message:
      'Danh mục không hợp lệ (PROFANITY, ADULT, SCAM, GAMBLING, OTHER)',
  })
  category: BannedWordCategory;

  @IsOptional()
  @IsEnum(BannedWordAction, {
    message: 'Hành động không hợp lệ (BLOCK, REVIEW)',
  })
  action?: BannedWordAction;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Ghi chú không được vượt quá 255 ký tự' })
  notes?: string;
}

export class UpdateBannedWordDto {
  @IsOptional()
  @IsEnum(BannedWordCategory, {
    message:
      'Danh mục không hợp lệ (PROFANITY, ADULT, SCAM, GAMBLING, OTHER)',
  })
  category?: BannedWordCategory;

  @IsOptional()
  @IsEnum(BannedWordAction, {
    message: 'Hành động không hợp lệ (BLOCK, REVIEW)',
  })
  action?: BannedWordAction;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Ghi chú không được vượt quá 255 ký tự' })
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ToggleBannedWordDto {
  @IsBoolean()
  isActive: boolean;
}

export class QueryBannedWordsDto {
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
  @IsEnum(BannedWordCategory)
  category?: BannedWordCategory;

  @IsOptional()
  @IsEnum(BannedWordAction, {
    message: 'Hành động không hợp lệ (BLOCK, REVIEW)',
  })
  action?: BannedWordAction;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}
