import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsMaxUtf8Bytes } from '@/common/decorators/is-max-utf8-bytes.decorator';

export class RegisterDto {
  @IsString({ message: 'Tên đăng nhập phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @MinLength(3, { message: 'Tên đăng nhập phải có ít nhất 3 ký tự' })
  @MaxLength(32, { message: 'Tên đăng nhập không được vượt quá 32 ký tự' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu chấm (.), gạch dưới (_) hoặc gạch ngang (-) và không chứa @',
  })
  username: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(15, { message: 'Mật khẩu phải có ít nhất 15 ký tự' })
  @IsMaxUtf8Bytes(72, { message: 'Mật khẩu không được dài quá 72 bytes UTF-8' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;

  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;
}
