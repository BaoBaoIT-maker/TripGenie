import { IsUUID, IsOptional } from 'class-validator';

export class TogglePlaceDto {
  @IsUUID('4', { message: 'Mã địa điểm không hợp lệ (phải là UUIDv4)' })
  placeId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Mã bộ sưu tập không hợp lệ (phải là UUIDv4)' })
  collectionId?: string;
}
