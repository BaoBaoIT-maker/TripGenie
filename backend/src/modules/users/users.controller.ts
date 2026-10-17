import { Controller, Patch, Get, Put, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';
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

  @Get('me/preferences')
  @UseGuards(JwtAuthGuard)
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    const preferences = await this.usersService.getUserPreferences(user.id);
    return {
      message: 'Lấy thông tin sở thích du lịch thành công',
      preferences,
    };
  }

  @Put('me/preferences')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserPreferenceDto,
  ) {
    const preferences = await this.usersService.updateUserPreferences(user.id, dto);
    return {
      message: 'Cập nhật sở thích du lịch thành công',
      preferences,
    };
  }
}

