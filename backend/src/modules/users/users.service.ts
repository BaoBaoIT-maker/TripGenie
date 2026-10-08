import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { IUsersRepository } from './interfaces/users-repository.interface';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    @Inject(INJECT_TOKENS.USER_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
  ) {}

  async updateUsername(userId: string, username: string): Promise<User> {
    const trimmedUsername = username.trim();
    const existing = await this.usersRepository.findByUsername(trimmedUsername);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Tên tài khoản này đã được sử dụng');
    }

    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return this.usersRepository.update(userId, {
      username: trimmedUsername,
    });
  }
}
