import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'Refresh Token phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Refresh Token không được để trống' })
  refreshToken: string;
}
