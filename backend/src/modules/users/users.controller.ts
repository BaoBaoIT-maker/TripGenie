import { Controller, Patch, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/types';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/username')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUsernameDto,
  ) {
    const updated = await this.usersService.updateUsername(user.id, dto.username);
    return {
      message: 'Cập nhật tên tài khoản thành công',
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        fullName: updated.fullName,
        avatarUrl: updated.avatarUrl,
        role: updated.role,
        isVerified: updated.isVerified,
      },
    };
  }
}
