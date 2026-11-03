import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { IUsersRepository } from './interfaces/users-repository.interface';
import { User, UserPreference, BudgetLevel } from '@prisma/client';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';

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

  async getUserPreferences(userId: string): Promise<UserPreference> {
    const existing = await this.usersRepository.findPreferences(userId);
    if (existing) {
      return existing;
    }

    // Default taste profile if not yet customized
    return {
      id: '',
      userId,
      budgetLevel: BudgetLevel.MEDIUM,
      travelStyle: ['CULTURE', 'FOOD', 'CHILL'],
      preferredCategories: ['am-thuc', 'cafe', 'diem-tham-quan'],
      dietaryRestrictions: [],
      updatedAt: new Date(),
    } as UserPreference;
  }

  async updateUserPreferences(
    userId: string,
    dto: UpdateUserPreferenceDto,
  ): Promise<UserPreference> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return this.usersRepository.upsertPreferences(userId, {
      budgetLevel: dto.budgetLevel,
      travelStyle: dto.travelStyle || [],
      preferredCategories: dto.preferredCategories || [],
      dietaryRestrictions: dto.dietaryRestrictions || [],
    });
  }
}

