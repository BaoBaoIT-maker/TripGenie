import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  BannedWordCategory,
  NotificationType,
  PostModerationStatus,
  ReportStatus,
  ReportTargetType,
  ReportType,
  UserRole,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import { AdminService } from './admin.service';
import { BannedWordsService } from './banned-words.service';
import { AdminModerationService } from './admin-moderation.service';
import { ADMIN_CONSTANTS, ADMIN_ERROR_CODES } from './admin.constants';

describe('AdminModerationService - 3-Tier AI Moderation & Anti-Brigading Reports', () => {
  let service: AdminModerationService;
  let mockPrisma: any;
  let mockAdminService: { logAudit: jest.Mock; resolvePagination: jest.Mock };
  let mockBannedWordsService: {
    checkBannedSync: jest.Mock;
    hasReviewTriggerSync: jest.Mock;
    normalizeForScan: jest.Mock;
  };
  let mockRedis: { get: jest.Mock; set: jest.Mock };

  const mockAdminUser: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@tripgenie.vn',
    username: 'admin',
    fullName: 'Master Admin',
    role: UserRole.ADMIN,
    avatarUrl: null,
    isVerified: true,
    authVersion: 1,
    jti: 'jti-123',
    exp: 9999999999,
  };

  const mockPostId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    mockPrisma = {
      communityPost: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: mockPostId,
          userId: '55555555-5555-4555-8555-555555555555',
          title: 'Review Hội An',
          deletedAt: null,
          moderationStatus: PostModerationStatus.PENDING,
        }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notification: {
        upsert: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
      contentReport: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockAdminService = {
      logAudit: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      resolvePagination: jest.fn((query: { page?: number; limit?: number }) => {
        const page = Math.max(query?.page ?? 1, 1);
        const limit = Math.min(Math.max(query?.limit ?? 20, 1), 100);
        return { page, limit, skip: (page - 1) * limit };
      }),
    };

    mockBannedWordsService = {
      // Default: nothing is banned or suspicious
      checkBannedSync: jest.fn().mockReturnValue({ isBanned: false }),
      hasReviewTriggerSync: jest.fn().mockReturnValue(false),
      normalizeForScan: jest.fn((t: string) => t.toLowerCase().trim()),
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue('true'),
      set: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminModerationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AdminService, useValue: mockAdminService },
        { provide: BannedWordsService, useValue: mockBannedWordsService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: string) => {
              if (key === 'GEMINI_API_KEY') return 'mock_key';
              return defaultVal;
            }),
          },
        },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AdminModerationService>(AdminModerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('AI Moderation Toggle Config', () => {
    it('should update AI moderation toggle in Redis and record AuditLog', async () => {
      const result = await service.updateModerationConfig(
        mockAdminUser,
        false,
        { ipAddress: '127.0.0.1' },
      );

      expect(result.aiModerationEnabled).toBe(false);
      expect(mockRedis.set).toHaveBeenCalledWith(
        ADMIN_CONSTANTS.REDIS_KEYS.AI_MODERATION_ENABLED,
        'false',
      );
      expect(mockAdminService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.SYSTEM_SETTING,
          afterData: { aiModerationEnabled: false },
        }),
      );
    });
  });

  describe('Tier 1 Sync Gate — assertContentAllowedSync', () => {
    it('should throw BadRequestException with category-specific error code without leaking matched keyword', () => {
      mockBannedWordsService.checkBannedSync.mockReturnValue({
        isBanned: true,
        matchedWord: 'kubet88',
        category: BannedWordCategory.GAMBLING,
      });

      expect(() =>
        service.assertContentAllowedSync('Tham gia n.h.à c.á.i kubet88 nhận thưởng'),
      ).toThrow(BadRequestException);

      try {
        service.assertContentAllowedSync('Tham gia kubet88 ngay');
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        const payload = err.getResponse();
        expect(payload.code).toBe(
          ADMIN_ERROR_CODES.CONTENT_VIOLATES_GAMBLING,
        );
        expect(JSON.stringify(payload)).not.toContain('kubet88');
      }
    });

    it.each([
      [BannedWordCategory.PROFANITY, ADMIN_ERROR_CODES.CONTENT_VIOLATES_PROFANITY],
      [BannedWordCategory.ADULT, ADMIN_ERROR_CODES.CONTENT_VIOLATES_ADULT],
      [BannedWordCategory.SCAM, ADMIN_ERROR_CODES.CONTENT_VIOLATES_SCAM],
      [BannedWordCategory.GAMBLING, ADMIN_ERROR_CODES.CONTENT_VIOLATES_GAMBLING],
      [BannedWordCategory.OTHER, ADMIN_ERROR_CODES.CONTENT_VIOLATES_POLICY],
    ])(
      'should map BannedWordCategory.%s to %s',
      (category, expectedCode) => {
        mockBannedWordsService.checkBannedSync.mockReturnValue({
          isBanned: true,
          matchedWord: 'tu-cam-test',
          category,
        });

        try {
          service.assertContentAllowedSync('Nội dung test');
          fail('Should have thrown BadRequestException');
        } catch (err: any) {
          expect(err.getResponse().code).toBe(expectedCode);
        }
      },
    );

    it('should pass clean and ambiguous content through (no throw)', () => {
      mockBannedWordsService.checkBannedSync.mockReturnValue({ isBanned: false });

      expect(() =>
        service.assertContentAllowedSync('Lịch trình chi tiết quá, cảm ơn bạn!'),
      ).not.toThrow();

      expect(() =>
        service.assertContentAllowedSync('Quán này ngon chết mê, không chặt chém!'),
      ).not.toThrow();
    });
  });

  describe('Tier 2 — matchesSuspiciousTriggers (DB REVIEW + structural regexes)', () => {
    it('returns true when BannedWordsService hasReviewTriggerSync flags text', () => {
      mockBannedWordsService.hasReviewTriggerSync.mockReturnValueOnce(true);

      expect(service.matchesSuspiciousTriggers('Quán làm ăn như cc')).toBe(
        true,
      );
      expect(mockBannedWordsService.hasReviewTriggerSync).toHaveBeenCalledWith(
        'Quán làm ăn như cc',
      );
    });

    it('returns true for structural triggers (Vietnamese phone numbers and external URLs) even when lexical DB returns false', () => {
      mockBannedWordsService.hasReviewTriggerSync.mockReturnValue(false);

      expect(
        service.matchesSuspiciousTriggers('Liên hệ số 0912345678 đặt tour'),
      ).toBe(true);
      expect(
        service.matchesSuspiciousTriggers(
          'Xem chi tiết tại https://example.com/tour',
        ),
      ).toBe(true);
    });

    it('returns false for clean content matching neither DB REVIEW words nor structural patterns', () => {
      mockBannedWordsService.hasReviewTriggerSync.mockReturnValue(false);

      expect(
        service.matchesSuspiciousTriggers(
          'Sáng săn mây đồi Đa Phú, chiều uống cà phê ngắm hoàng hôn rất chill.',
        ),
      ).toBe(false);
    });
  });

  describe('Tier 3 — evaluatePostAsync (async background moderation)', () => {
    it('AI OFF: post stays PENDING with manual queue note', async () => {
      mockRedis.get.mockResolvedValue('false');

      let capturedData: any;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          communityPost: {
            updateMany: jest.fn().mockImplementation(({ data }: any) => {
              capturedData = data;
              return { count: 1 };
            }),
          },
          notification: {
            upsert: jest.fn().mockResolvedValue({ id: 'notif-1' }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        };
        return cb(mockTx);
      });

      await service.evaluatePostAsync(mockPostId, 'Lịch trình Đà Lạt 3N2Đ');

      expect(capturedData.moderationStatus).toBe(PostModerationStatus.PENDING);
      expect(capturedData.moderationNote).toBe(
        ADMIN_CONSTANTS.MESSAGES.PENDING_MANUAL_MODERATION_NOTE,
      );
    });

    it('AI ON (mock_key → fail-closed): post is FLAGGED for human review', async () => {
      mockRedis.get.mockResolvedValue('true');

      let capturedData: any;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          communityPost: {
            updateMany: jest.fn().mockImplementation(({ data }: any) => {
              capturedData = data;
              return { count: 1 };
            }),
          },
          notification: {
            upsert: jest.fn().mockResolvedValue({ id: 'notif-1' }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        };
        return cb(mockTx);
      });

      // mock_key causes evaluateWithGemini → aiUnavailableResult → FLAGGED
      await service.evaluatePostAsync(
        mockPostId,
        'Cảnh báo lừa đảo đặt cọc phòng khách sạn qua Zalo',
      );

      expect(capturedData.moderationStatus).toBe(PostModerationStatus.FLAGGED);
      expect(capturedData.moderationNote).toBe(
        ADMIN_CONSTANTS.MESSAGES.AI_UNAVAILABLE_NOTE,
      );
    });

    it('should not overwrite a post that was already reviewed (admin decision wins)', async () => {
      mockRedis.get.mockResolvedValue('false');

      let updateManyCallCount = 0;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          communityPost: {
            // count: 0 → admin already acted, updateMany skips sync
            updateMany: jest.fn().mockImplementation(() => {
              updateManyCallCount++;
              return { count: 0 }; // 0 rows updated: post not in PENDING state
            }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        };
        return cb(mockTx);
      });

      await service.evaluatePostAsync(
        '22222222-2222-4222-8222-222222222222',
        'some text',
      );

      // updateMany was called with moderationStatus: PENDING filter, found 0 rows — correct
      expect(updateManyCallCount).toBe(1);
    });
  });

  describe('Admin Approve & Reject Post Actions', () => {
    it('approvePost should set status to APPROVED, sync group post counts, and log audit', async () => {
      const mockTx = {
        communityPost: {
          findUnique: jest.fn().mockResolvedValue({
            id: mockPostId,
            userId: '55555555-5555-4555-8555-555555555555',
            title: 'Review Hội An',
            moderationStatus: PostModerationStatus.PENDING,
            moderationNote: null,
            deletedAt: null,
          }),
          update: jest.fn().mockResolvedValue({
            id: mockPostId,
            userId: '55555555-5555-4555-8555-555555555555',
            title: 'Review Hội An',
            moderationStatus: PostModerationStatus.APPROVED,
          }),
        },
        notification: {
          upsert: jest.fn().mockResolvedValue({ id: 'notif-1' }),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.approvePost(mockAdminUser, mockPostId, {
        reason: 'Nội dung tốt',
      });

      expect(result.success).toBe(true);
      expect(mockTx.communityPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPostId },
          data: expect.objectContaining({
            moderationStatus: PostModerationStatus.APPROVED,
          }),
        }),
      );
      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mockAdminService.logAudit).toHaveBeenCalled();
    });
  });

  describe('Anti-Brigading Report Center (>= 20 Reports High Priority Alert)', () => {
    it('getModerationReports should flag isHighPriorityAlert when reportCount >= 20 without auto-hiding post', async () => {
      mockPrisma.contentReport.groupBy.mockResolvedValue([
        {
          targetType: ReportTargetType.POST,
          targetId: 'post-brigaded-1',
          _count: { _all: 25 },
        },
        {
          targetType: ReportTargetType.POST,
          targetId: 'post-normal-2',
          _count: { _all: 2 },
        },
      ]);

      mockPrisma.$transaction.mockResolvedValue([
        2,
        [
          {
            id: 'rep-1',
            targetType: ReportTargetType.POST,
            targetId: 'post-brigaded-1',
            reportType: ReportType.SPAM,
            status: ReportStatus.PENDING,
          },
          {
            id: 'rep-2',
            targetType: ReportTargetType.POST,
            targetId: 'post-normal-2',
            reportType: ReportType.OTHER,
            status: ReportStatus.PENDING,
          },
        ],
      ]);

      const result = await service.getModerationReports({ page: 1, limit: 20 });

      expect(result.meta.highPriorityAlertCount).toBe(1);
      expect(result.meta.highPriorityReportThreshold).toBe(20);
      expect(result.items[0].targetReportCount).toBe(25);
      expect(result.items[0].isHighPriorityAlert).toBe(true);
      expect(result.items[1].targetReportCount).toBe(2);
      expect(result.items[1].isHighPriorityAlert).toBe(false);
    });

    it('resolveReport with DISMISS should close reports as DISMISSED and keep post untouched', async () => {
      const mockTx = {
        contentReport: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'rep-1',
            targetType: ReportTargetType.POST,
            targetId: 'post-brigaded-1',
            status: ReportStatus.PENDING,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 25 }),
        },
        communityPost: {
          updateMany: jest.fn(),
        },
        $executeRaw: jest.fn(),
      };
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.resolveReport(mockAdminUser, 'rep-1', {
        action: 'DISMISS',
        resolutionNote: 'Bị đối thủ công kích report ảo, bài viết hợp lệ',
      });

      expect(result.success).toBe(true);
      expect(mockTx.contentReport.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ReportStatus.DISMISSED,
          }),
        }),
      );
      expect(mockTx.communityPost.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Tier 3 — evaluatePostAsync (Publish-First / Cách A)', () => {
    it('auto-published (APPROVED, moderatedAt: null) with AI OFF should retract to FLAGGED, decrement group count, and notify user', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: mockPostId,
        userId: '55555555-5555-4555-8555-555555555555',
        deletedAt: null,
        moderationStatus: PostModerationStatus.APPROVED,
        moderatedAt: null,
      });
      mockRedis.get.mockResolvedValue('false');

      let capturedWhere: any;
      let capturedData: any;
      const upsertSpy = jest.fn().mockResolvedValue({ id: 'notif-1' });
      const executeRawSpy = jest.fn().mockResolvedValue(1);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          communityPost: {
            updateMany: jest.fn().mockImplementation(({ where, data }: any) => {
              capturedWhere = where;
              capturedData = data;
              return { count: 1 };
            }),
          },
          notification: { upsert: upsertSpy },
          $executeRaw: executeRawSpy,
        });
      });

      await service.evaluatePostAsync(mockPostId, 'Liên hệ zalo đặt cọc ngay');

      expect(capturedWhere).toEqual({
        id: mockPostId,
        deletedAt: null,
        moderationStatus: PostModerationStatus.APPROVED,
        moderatedAt: null,
      });
      expect(capturedData.moderationStatus).toBe(PostModerationStatus.FLAGGED);
      expect(capturedData.moderationNote).toBe(
        ADMIN_CONSTANTS.MESSAGES.PENDING_MANUAL_MODERATION_NOTE,
      );
      expect(capturedData.moderatedAt).toBeInstanceOf(Date);
      expect(executeRawSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: NotificationType.POST_FLAGGED,
          }),
        }),
      );
    });

    it('auto-published (APPROVED, moderatedAt: null) with Gemini REJECTED should retract post, sync group count, and send POST_REJECTED notification', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: mockPostId,
        userId: '55555555-5555-4555-8555-555555555555',
        deletedAt: null,
        moderationStatus: PostModerationStatus.APPROVED,
        moderatedAt: null,
      });
      mockRedis.get.mockResolvedValue('true');
      jest.spyOn(service as any, 'evaluateWithGemini').mockResolvedValueOnce({
        status: PostModerationStatus.REJECTED,
        reason: 'Có dấu hiệu lừa đảo chuyển khoản',
      });

      let capturedData: any;
      const upsertSpy = jest.fn().mockResolvedValue({ id: 'notif-2' });
      const executeRawSpy = jest.fn().mockResolvedValue(1);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          communityPost: {
            updateMany: jest.fn().mockImplementation(({ data }: any) => {
              capturedData = data;
              return { count: 1 };
            }),
          },
          notification: { upsert: upsertSpy },
          $executeRaw: executeRawSpy,
        });
      });

      await service.evaluatePostAsync(mockPostId, 'Chuyển khoản cọc ngay');

      expect(capturedData.moderationStatus).toBe(PostModerationStatus.REJECTED);
      expect(capturedData.moderationNote).toBe(
        'Có dấu hiệu lừa đảo chuyển khoản',
      );
      expect(executeRawSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: NotificationType.POST_REJECTED,
          }),
        }),
      );
    });

    it('auto-published (APPROVED, moderatedAt: null) with Gemini APPROVED should stamp moderatedAt without resyncing group count or sending duplicate notification', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: mockPostId,
        userId: '55555555-5555-4555-8555-555555555555',
        deletedAt: null,
        moderationStatus: PostModerationStatus.APPROVED,
        moderatedAt: null,
      });
      mockRedis.get.mockResolvedValue('true');
      jest.spyOn(service as any, 'evaluateWithGemini').mockResolvedValueOnce({
        status: PostModerationStatus.APPROVED,
        reason: 'Nội dung du lịch hợp lệ',
      });

      let capturedData: any;
      const upsertSpy = jest.fn();
      const executeRawSpy = jest.fn();

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          communityPost: {
            updateMany: jest.fn().mockImplementation(({ data }: any) => {
              capturedData = data;
              return { count: 1 };
            }),
          },
          notification: { upsert: upsertSpy },
          $executeRaw: executeRawSpy,
        });
      });

      await service.evaluatePostAsync(
        mockPostId,
        'Quán này ăn ngon không chặt chém',
      );

      expect(capturedData.moderationStatus).toBe(PostModerationStatus.APPROVED);
      expect(capturedData.moderatedAt).toBeInstanceOf(Date);
      expect(executeRawSpy).not.toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('already moderated post (APPROVED with moderatedAt !== null) should be skipped cleanly', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: mockPostId,
        userId: '55555555-5555-4555-8555-555555555555',
        deletedAt: null,
        moderationStatus: PostModerationStatus.APPROVED,
        moderatedAt: new Date(),
      });

      await service.evaluatePostAsync(mockPostId, 'Nội dung nghi ngờ');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
