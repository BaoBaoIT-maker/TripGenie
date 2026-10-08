import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class StartGoogleLinkDto {
  @IsString({ message: 'Mã xác thực lại (grantToken) phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã xác thực lại không được để trống' })
  grantToken: string;

  @IsOptional()
  @IsString({ message: 'Đường dẫn chuyển tiếp phải là chuỗi ký tự' })
  returnUrl?: string;
}
