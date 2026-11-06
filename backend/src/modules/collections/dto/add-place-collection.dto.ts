import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AddPlaceCollectionDto {
  @IsUUID('4', { message: 'Mã địa điểm không hợp lệ (phải là UUIDv4)' })
  placeId: string;

  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}
