import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class TriggerEnrichmentDto {
  @IsInt({ message: 'areaId phải là số nguyên' })
  @Min(1, { message: 'areaId phải lớn hơn 0' })
  areaId: number;

  @IsOptional()
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(100, { message: 'limit tối đa là 100 địa điểm mỗi lần' })
  limit?: number;
}
