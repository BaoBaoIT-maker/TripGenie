import { IsNotEmpty, IsUUID } from 'class-validator';

export class ResendVerificationEmailDto {
  @IsUUID('4', { message: 'Mã phiên đăng ký không hợp lệ' })
  @IsNotEmpty({ message: 'Mã phiên đăng ký không được để trống' })
  registrationId: string;
}
