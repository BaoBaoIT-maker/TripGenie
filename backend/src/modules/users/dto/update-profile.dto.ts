import { IsString, IsOptional, MaxLength, MinLength, Matches } from 'class-validator';
import { USERS_CONSTANTS } from '../users.constants';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Họ và tên phải là chuỗi ký tự hợp lệ' })
  @MinLength(USERS_CONSTANTS.MIN_FULLNAME_LENGTH, {
    message: `Họ và tên phải có ít nhất ${USERS_CONSTANTS.MIN_FULLNAME_LENGTH} ký tự`,
  })
  @MaxLength(USERS_CONSTANTS.MAX_FULLNAME_LENGTH, {
    message: `Họ và tên không được vượt quá ${USERS_CONSTANTS.MAX_FULLNAME_LENGTH} ký tự`,
  })
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'Tiểu sử phải là chuỗi ký tự hợp lệ' })
  @MaxLength(USERS_CONSTANTS.MAX_BIO_LENGTH, {
    message: `Tiểu sử không được vượt quá ${USERS_CONSTANTS.MAX_BIO_LENGTH} ký tự`,
  })
  bio?: string;

  @IsOptional()
  @IsString({ message: 'URL ảnh đại diện phải là chuỗi hợp lệ' })
  @MaxLength(USERS_CONSTANTS.MAX_AVATAR_URL_LENGTH, {
    message: `URL ảnh đại diện không được vượt quá ${USERS_CONSTANTS.MAX_AVATAR_URL_LENGTH} ký tự`,
  })
  @Matches(USERS_CONSTANTS.SAFE_AVATAR_URL_REGEX, {
    message:
      'URL ảnh đại diện phải là đường dẫn ảnh cục bộ hợp lệ (/avatars/..., /api/v1/uploads/...) hoặc URL http(s) an toàn',
  })
  avatarUrl?: string;
}
