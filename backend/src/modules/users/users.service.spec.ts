import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { BudgetLevel } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: {
    findByUsername: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    findPreferences: jest.Mock;
    upsertPreferences: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findByUsername: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findPreferences: jest.fn(),
      upsertPreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: INJECT_TOKENS.USER_REPOSITORY,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateAvatar', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.updateAvatar('user-999', '/avatars/avatar-1.jpg')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should successfully update avatarUrl', async () => {
      mockRepo.findById.mockResolvedValue({ id: 'user-1', fullName: 'Nguyen Van A' });
      mockRepo.update.mockResolvedValue({
        id: 'user-1',
        fullName: 'Nguyen Van A',
        avatarUrl: '/avatars/avatar-1.jpg',
      });

      const result = await service.updateAvatar('user-1', '  /avatars/avatar-1.jpg  ');

      expect(mockRepo.update).toHaveBeenCalledWith('user-1', {
        avatarUrl: '/avatars/avatar-1.jpg',
      });
      expect(result.avatarUrl).toBe('/avatars/avatar-1.jpg');
    });
  });

  describe('getUserPreferences', () => {
    it('should return existing preferences if found', async () => {
      const mockPref = {
        id: 'pref-1',
        userId: 'user-1',
        budgetLevel: BudgetLevel.HIGH,
        travelStyle: ['LUXURY', 'RELAX'],
        preferredCategories: ['resort', 'spa'],
        dietaryRestrictions: ['VEGETARIAN'],
        updatedAt: new Date(),
      };
      mockRepo.findPreferences.mockResolvedValue(mockPref);

      const result = await service.getUserPreferences('user-1');

      expect(result).toEqual(mockPref);
      expect(mockRepo.findPreferences).toHaveBeenCalledWith('user-1');
    });

    it('should return default taste profile if none found in DB', async () => {
      mockRepo.findPreferences.mockResolvedValue(null);

      const result = await service.getUserPreferences('user-1');

      expect(result.budgetLevel).toBe(BudgetLevel.MEDIUM);
      expect(result.travelStyle).toContain('CULTURE');
      expect(result.preferredCategories).toContain('am-thuc');
      expect(result.dietaryRestrictions).toEqual([]);
    });
  });

  describe('updateUserPreferences', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateUserPreferences('user-999', {
          budgetLevel: BudgetLevel.LOW,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call upsertPreferences with mapped payload', async () => {
      mockRepo.findById.mockResolvedValue({ id: 'user-1' });
      const expectedPref = {
        id: 'pref-1',
        userId: 'user-1',
        budgetLevel: BudgetLevel.LOW,
        travelStyle: ['BACKPACKING'],
        preferredCategories: ['hostel'],
        dietaryRestrictions: [],
        updatedAt: new Date(),
      };
      mockRepo.upsertPreferences.mockResolvedValue(expectedPref);

      const result = await service.updateUserPreferences('user-1', {
        budgetLevel: BudgetLevel.LOW,
        travelStyle: ['BACKPACKING'],
        preferredCategories: ['hostel'],
        dietaryRestrictions: [],
      });

      expect(result).toEqual(expectedPref);
      expect(mockRepo.upsertPreferences).toHaveBeenCalledWith('user-1', {
        budgetLevel: BudgetLevel.LOW,
        travelStyle: ['BACKPACKING'],
        preferredCategories: ['hostel'],
        dietaryRestrictions: [],
      });
    });
  });
});
