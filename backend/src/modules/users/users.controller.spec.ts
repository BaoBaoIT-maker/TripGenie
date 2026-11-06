import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { BudgetLevel, UserRole } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let mockUsersService: {
    updateUsername: jest.Mock;
    updateAvatar: jest.Mock;
    getUserPreferences: jest.Mock;
    updateUserPreferences: jest.Mock;
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: UserRole.USER,
  } as any;

  beforeEach(async () => {
    mockUsersService = {
      updateUsername: jest.fn(),
      updateAvatar: jest.fn(),
      getUserPreferences: jest.fn(),
      updateUserPreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updateAvatar', () => {
    it('should update avatar and return user info', async () => {
      const updatedUser = {
        id: 'user-1',
        username: 'nguyenvana',
        email: 'test@example.com',
        fullName: 'Nguyen Van A',
        avatarUrl: '/avatars/avatar-1.jpg',
        role: UserRole.USER,
        isVerified: true,
      };
      mockUsersService.updateAvatar.mockResolvedValue(updatedUser);

      const result = await controller.updateAvatar(mockUser, {
        avatarUrl: '/avatars/avatar-1.jpg',
      });

      expect(mockUsersService.updateAvatar).toHaveBeenCalledWith('user-1', '/avatars/avatar-1.jpg');
      expect(result.message).toBe('Cập nhật ảnh đại diện thành công');
      expect(result.user.avatarUrl).toBe('/avatars/avatar-1.jpg');
    });
  });

  describe('getPreferences', () => {
    it('should return preferences for the current user', async () => {
      const mockPref = {
        id: 'pref-1',
        userId: 'user-1',
        budgetLevel: BudgetLevel.MEDIUM,
        travelStyle: ['CULTURE'],
        preferredCategories: ['am-thuc'],
        dietaryRestrictions: [],
        updatedAt: new Date(),
      };
      mockUsersService.getUserPreferences.mockResolvedValue(mockPref);

      const result = await controller.getPreferences(mockUser);
      expect(result.preferences).toEqual(mockPref);
      expect(mockUsersService.getUserPreferences).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updatePreferences', () => {
    it('should update and return preferences', async () => {
      const dto = {
        budgetLevel: BudgetLevel.HIGH,
        travelStyle: ['NATURE'],
        preferredCategories: ['diem-tham-quan'],
        dietaryRestrictions: ['HALAL'],
      };
      const mockPref = { ...dto, id: 'pref-1', userId: 'user-1', updatedAt: new Date() };
      mockUsersService.updateUserPreferences.mockResolvedValue(mockPref);

      const result = await controller.updatePreferences(mockUser, dto);
      expect(result.preferences).toEqual(mockPref);
      expect(mockUsersService.updateUserPreferences).toHaveBeenCalledWith('user-1', dto);
    });
  });
});
