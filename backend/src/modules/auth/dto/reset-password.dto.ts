import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IsMaxUtf8Bytes } from '@/common/decorators/is-max-utf8-bytes.decorator';

export class ResetPasswordDto {
  @IsString({ message: 'Vé đặt lại mật khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vé đặt lại mật khẩu không được để trống' })
  resetTicket: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(15, { message: 'Mật khẩu phải có ít nhất 15 ký tự' })
  @IsMaxUtf8Bytes(72, { message: 'Mật khẩu không được dài quá 72 bytes UTF-8' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;
}
