import { Test, TestingModule } from '@nestjs/testing';
import {
  AuditAction,
  BannedWordAction,
  BannedWordCategory,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import { AdminService } from './admin.service';
import { BannedWordsService } from './banned-words.service';
import { ADMIN_CONSTANTS } from './admin.constants';

describe('BannedWordsService - Dual-Tier Cache (BLOCK vs REVIEW)', () => {
  let service: BannedWordsService;
  let mockPrisma: any;
  let mockAdminService: {
    logAudit: jest.Mock;
    resolvePagination: jest.Mock;
    buildPaginatedResponse: jest.Mock;
  };

  const mockAdmin: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@tripgenie.vn',
    username: 'admin',
    fullName: 'Master Admin',
    role: UserRole.ADMIN,
    avatarUrl: null,
    isVerified: true,
    authVersion: 1,
    jti: 'jti-1',
    exp: 9999999999,
  };

  const activeWordFixtures = [
    {
      word: 'kubet',
      category: BannedWordCategory.GAMBLING,
      action: BannedWordAction.BLOCK,
    },
    {
      word: 'đm',
      category: BannedWordCategory.PROFANITY,
      action: BannedWordAction.BLOCK,
    },
    {
      word: 'cc',
      category: BannedWordCategory.PROFANITY,
      action: BannedWordAction.REVIEW,
    },
    {
      word: 'đánh bạc',
      category: BannedWordCategory.GAMBLING,
      action: BannedWordAction.REVIEW,
    },
  ];

  beforeEach(async () => {
    mockPrisma = {
      bannedWord: {
        findMany: jest.fn().mockResolvedValue(activeWordFixtures),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(),
    };

    mockAdminService = {
      logAudit: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      resolvePagination: jest.fn(() => ({ page: 1, limit: 20, skip: 0 })),
      buildPaginatedResponse: jest.fn((items, total, page, limit) => ({
        items,
        meta: { total, page, limit, totalPages: 1 },
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BannedWordsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compile();

    service = module.get<BannedWordsService>(BannedWordsService);
    await service.reloadCache();
  });

  it('reloadCache separates BLOCK and REVIEW words cleanly without cross-triggering', () => {
    // BLOCK word triggers checkBannedSync, not hasReviewTriggerSync
    const blockCheck = service.checkBannedSync('Tham gia k.u.b.e.t ngay');
    expect(blockCheck).toEqual({
      isBanned: true,
      matchedWord: 'kubet',
      category: BannedWordCategory.GAMBLING,
    });
    expect(service.hasReviewTriggerSync('Tham gia kubet ngay')).toBe(false);

    // REVIEW words do not trigger Tier 1 hard block
    expect(service.checkBannedSync('Quán làm ăn như cc')).toEqual({
      isBanned: false,
    });
    expect(service.checkBannedSync('Cảnh báo bẫy đánh bạc gần cửa khẩu')).toEqual({
      isBanned: false,
    });
  });

  it('hasReviewTriggerSync detects separator evasion and honors Unicode word boundaries on short REVIEW terms', () => {
    // Standalone and separator-evaded forms trigger Tier 2
    expect(service.hasReviewTriggerSync('Dịch vụ như cc')).toBe(true);
    expect(service.hasReviewTriggerSync('Dịch vụ như c.c')).toBe(true);
    expect(service.hasReviewTriggerSync('Rủ nhau đ.á.n.h b.ạ.c qua đêm')).toBe(
      true,
    );

    // Bounded tokens inside longer words/numbers must NOT false-positive
    expect(service.hasReviewTriggerSync('Thuê xe côn tay 150cc đi đèo')).toBe(
      false,
    );
    expect(
      service.hasReviewTriggerSync('Chúc chuyến đi success tốt đẹp'),
    ).toBe(false);
  });

  it('create defaults action to BLOCK and supports explicit REVIEW with AuditLog + cache reload', async () => {
    mockPrisma.bannedWord.findUnique.mockResolvedValue(null);
    mockPrisma.bannedWord.create
      .mockResolvedValueOnce({
        id: 'bw-1',
        word: 'từ cấm mặc định',
        category: BannedWordCategory.SCAM,
        action: BannedWordAction.BLOCK,
      })
      .mockResolvedValueOnce({
        id: 'bw-2',
        word: 'từ duyệt ai',
        category: BannedWordCategory.PROFANITY,
        action: BannedWordAction.REVIEW,
      });

    await service.create(mockAdmin, {
      word: 'Từ Cấm Mặc Định',
      category: BannedWordCategory.SCAM,
    });
    expect(mockPrisma.bannedWord.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          word: 'từ cấm mặc định',
          action: BannedWordAction.BLOCK,
        }),
      }),
    );

    await service.create(mockAdmin, {
      word: 'Từ Duyệt AI',
      category: BannedWordCategory.PROFANITY,
      action: BannedWordAction.REVIEW,
    });
    expect(mockPrisma.bannedWord.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          word: 'từ duyệt ai',
          action: BannedWordAction.REVIEW,
        }),
      }),
    );

    // Initial reloadCache + 2 create reloads
    expect(mockPrisma.bannedWord.findMany).toHaveBeenCalledTimes(3);
    expect(mockAdminService.logAudit).toHaveBeenCalledTimes(2);
  });

  it('update switches action BLOCK <-> REVIEW, writes AuditLog diff, and reloads RAM regex cache', async () => {
    const existing = {
      id: 'bw-switch-1',
      word: 'cc',
      category: BannedWordCategory.PROFANITY,
      action: BannedWordAction.REVIEW,
      notes: 'Cũ',
      isActive: true,
    };
    const updated = { ...existing, action: BannedWordAction.BLOCK };

    mockPrisma.bannedWord.findUnique.mockResolvedValue(existing);
    mockPrisma.bannedWord.update.mockResolvedValue(updated);

    const res = await service.update(mockAdmin, existing.id, {
      action: BannedWordAction.BLOCK,
    });

    expect(res.action).toBe(BannedWordAction.BLOCK);
    expect(mockPrisma.bannedWord.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { action: BannedWordAction.BLOCK },
    });
    expect(mockAdminService.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.BANNED_WORD,
        targetId: existing.id,
        beforeData: expect.objectContaining({ action: BannedWordAction.REVIEW }),
        afterData: expect.objectContaining({ action: BannedWordAction.BLOCK }),
      }),
    );
    expect(mockPrisma.bannedWord.findMany).toHaveBeenCalledTimes(2);
  });
});
