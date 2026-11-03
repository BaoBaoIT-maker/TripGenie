import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateAvatarDto {
  @IsString({ message: 'URL ảnh đại diện phải là chuỗi hợp lệ' })
  @IsNotEmpty({ message: 'URL ảnh đại diện không được để trống' })
  @MaxLength(5000000, { message: 'Dữ liệu ảnh đại diện không được vượt quá 5MB' })
  avatarUrl: string;
}
