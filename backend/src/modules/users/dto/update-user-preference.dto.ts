import { IsEnum, IsArray, IsString, IsOptional } from 'class-validator';
import { BudgetLevel } from '@prisma/client';

export class UpdateUserPreferenceDto {
  @IsEnum(BudgetLevel, { message: 'Mức ngân sách không hợp lệ (LOW, MEDIUM, HIGH, LUXURY)' })
  budgetLevel: BudgetLevel;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  travelStyle?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredCategories?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dietaryRestrictions?: string[] = [];
}
