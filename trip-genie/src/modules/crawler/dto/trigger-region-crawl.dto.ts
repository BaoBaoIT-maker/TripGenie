import { IsInt, IsNotEmpty } from 'class-validator';

export class TriggerRegionCrawlDto {
  @IsInt()
  @IsNotEmpty()
  areaId: number;
}
