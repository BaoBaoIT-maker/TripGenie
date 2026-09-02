import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString({ message: 'Mã OTP phải là chuỗi ký tự' })
  @Length(6, 6, { message: 'Mã OTP phải có đúng 6 chữ số' })
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  otp: string;
}
