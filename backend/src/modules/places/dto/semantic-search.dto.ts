import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SemanticSearchDto {
  @IsNotEmpty()
  @IsString()
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  areaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number = 0.3;
}

export class SyncEmbeddingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  areaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
