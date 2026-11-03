import { IsEmail, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class ResendOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsOptional()
  @IsIn(['email-verification', 'password-reset'], {
    message: 'Mục đích xác thực không hợp lệ',
  })
  purpose?: 'email-verification' | 'password-reset';
}
