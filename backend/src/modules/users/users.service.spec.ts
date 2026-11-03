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

    it('should return default preferences if none found', async () => {
      mockRepo.findPreferences.mockResolvedValue(null);

      const result = await service.getUserPreferences('user-1');
      expect(result.userId).toBe('user-1');
      expect(result.budgetLevel).toBe(BudgetLevel.MEDIUM);
      expect(result.travelStyle).toContain('CULTURE');
    });
  });

  describe('updateUserPreferences', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateUserPreferences('non-existent', {
          budgetLevel: BudgetLevel.LOW,
          travelStyle: ['BACKPACKING'],
          preferredCategories: ['hostel'],
          dietaryRestrictions: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert preferences when user exists', async () => {
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

