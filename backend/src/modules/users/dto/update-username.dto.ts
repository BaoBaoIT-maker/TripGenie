import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUsernameDto {
  @IsString({ message: 'Tên tài khoản phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên tài khoản không được để trống' })
  @MinLength(3, { message: 'Tên tài khoản phải có ít nhất 3 ký tự' })
  @MaxLength(32, { message: 'Tên tài khoản không được vượt quá 32 ký tự' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Tên tài khoản chỉ được chứa chữ cái, số, dấu chấm (.), gạch dưới (_) hoặc gạch ngang (-) và không chứa @',
  })
  username: string;
}
