import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IsMaxUtf8Bytes } from '@/common/decorators/is-max-utf8-bytes.decorator';
import { AUTH_CONSTANTS } from '@/common/constants/auth.constants';

export class ResetPasswordDto {
  @IsString({ message: 'Vé đặt lại mật khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vé đặt lại mật khẩu không được để trống' })
  resetTicket: string;

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
