import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateCollectionDto {
  @IsOptional()
  @IsString({ message: 'Tên bộ sưu tập phải là chuỗi' })
  @MaxLength(255, { message: 'Tên bộ sưu tập tối đa 255 ký tự' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: 'isPublic phải là kiểu boolean' })
  isPublic?: boolean;

  @IsOptional()
  @IsString({ message: 'Ảnh bìa phải là chuỗi URL' })
  coverImage?: string;
}
