import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { IsMaxUtf8Bytes } from '@/common/decorators/is-max-utf8-bytes.decorator';
import { AUTH_CONSTANTS } from '@/common/constants/auth.constants';

export class RegisterDto {
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Họ tên không được vượt quá 100 ký tự' })
  fullName: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(AUTH_CONSTANTS.PASSWORD_MIN_LENGTH, {
    message: `Mật khẩu phải có ít nhất ${AUTH_CONSTANTS.PASSWORD_MIN_LENGTH} ký tự`,
  })
  @IsMaxUtf8Bytes(AUTH_CONSTANTS.PASSWORD_MAX_BYTES, {
    message: `Mật khẩu không được dài quá ${AUTH_CONSTANTS.PASSWORD_MAX_BYTES} bytes UTF-8`,
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;
}
