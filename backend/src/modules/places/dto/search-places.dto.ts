import {
  IsOptional,
  IsString,
  IsInt,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BudgetLevel } from '@prisma/client';
import { PlaceSortBy, SortOrder } from '../../../common/enums/places.enum';

/** Safe transformer for comma-delimited strings or native array query parameters */
const transformStringArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return undefined;
};

/** Safe transformer for comma-delimited enum values */
const transformBudgetLevels = ({ value }: { value: unknown }): BudgetLevel[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const rawList = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').map((s) => s.trim())
      : [];
  const validLevels = Object.values(BudgetLevel);
  const filtered = rawList.filter((v) => validLevels.includes(v as BudgetLevel)) as BudgetLevel[];
  return filtered.length > 0 ? filtered : undefined;
};

/** Safe boolean transformer from query param ("true", "1", true) */
const transformBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return value === 'true' || value === true || value === '1' || value === 1;
};

export class SearchPlacesDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  areaId?: number;

  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  categorySlugs?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50000)
  radiusMeters?: number = 5000;

  @IsOptional()
  @Transform(transformBudgetLevels)
  @IsArray()
  @IsEnum(BudgetLevel, { each: true })
  budgetLevels?: BudgetLevel[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @Transform(transformBoolean)
  @IsBoolean()
  openNow?: boolean;

  @IsOptional()
  @IsEnum(PlaceSortBy)
  sortBy?: PlaceSortBy = PlaceSortBy.DISTANCE;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
