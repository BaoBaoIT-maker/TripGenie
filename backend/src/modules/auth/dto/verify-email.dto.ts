import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsString({ message: 'Mã xác thực email phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã xác thực email không được để trống' })
  token: string;
}
