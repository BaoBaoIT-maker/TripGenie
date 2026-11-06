import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { USERS_CONSTANTS } from '../users.constants';

export class UpdateAvatarDto {
  @IsString({ message: 'URL ảnh đại diện phải là chuỗi hợp lệ' })
  @IsNotEmpty({ message: 'URL ảnh đại diện không được để trống' })
  @MaxLength(USERS_CONSTANTS.MAX_AVATAR_URL_LENGTH, {
    message: `URL ảnh đại diện không được vượt quá ${USERS_CONSTANTS.MAX_AVATAR_URL_LENGTH} ký tự`,
  })
  @Matches(USERS_CONSTANTS.SAFE_AVATAR_URL_REGEX, {
    message:
      'URL ảnh đại diện phải là đường dẫn ảnh cục bộ hợp lệ (/avatars/..., /api/v1/uploads/...) hoặc URL http(s) an toàn',
  })
  avatarUrl: string;
}
