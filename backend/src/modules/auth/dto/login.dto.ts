import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'Tên đăng nhập hoặc email phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên đăng nhập hoặc email không được để trống' })
  identifier: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;
}
