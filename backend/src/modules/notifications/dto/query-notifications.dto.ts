import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NOTIFICATIONS_CONSTANTS, NotificationFilter } from '../notifications.constants';

export class QueryNotificationsDto {
  @IsOptional()
  @IsEnum(['ALL', 'UNREAD'], { message: 'filter phải là ALL hoặc UNREAD' })
  filter?: NotificationFilter = 'ALL';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(NOTIFICATIONS_CONSTANTS.MAX_LIMIT, {
    message: `limit tối đa là ${NOTIFICATIONS_CONSTANTS.MAX_LIMIT}`,
  })
  limit?: number = NOTIFICATIONS_CONSTANTS.DEFAULT_LIMIT;

  @IsOptional()
  @IsString({ message: 'cursor phải là chuỗi hợp lệ' })
  cursor?: string;
}
