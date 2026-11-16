import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
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
import { AdminModerationService } from './admin-moderation.service';
import { ADMIN_CONSTANTS, ADMIN_ERROR_CODES } from './admin.constants';

describe('AdminModerationService - Step 5: 3-Tier AI Moderation & Anti-Brigading Reports', () => {
  let service: AdminModerationService;
  let mockPrisma: any;
  let mockAdminService: { logAudit: jest.Mock };
  let mockRedis: { get: jest.Mock; set: jest.Mock };

  const mockAdminUser: AuthenticatedUser = {
    id: 'admin-1',
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

  beforeEach(async () => {
    mockPrisma = {
      communityPost: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
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

  describe('3-Tier Post Evaluation Funnel (Gatekeeper)', () => {
    it('Tier 1: should immediately reject posts with hard profanity or gambling spam (including leetspeak)', async () => {
      const res1 = await service.evaluatePostForCreation({
        title: 'Tham gia n.h.à c.á.i kubet nhận thưởng',
        caption: 'Chơi tài xỉu thắng lớn',
      });
      expect(res1.status).toBe(PostModerationStatus.REJECTED);
      expect(res1.tier).toBe('HARD_BLOCKLIST');

      const res2 = await service.evaluatePostForCreation({
        title: 'What the fuck is this place',
        caption: 'So bad đ.m',
      });
      expect(res2.status).toBe(PostModerationStatus.REJECTED);
      expect(res2.tier).toBe('HARD_BLOCKLIST');
    });

    it('Manual Mode (AI OFF): should place clean posts into PENDING manual queue', async () => {
      mockRedis.get.mockResolvedValue('false');

      const res = await service.evaluatePostForCreation({
        title: 'Lịch trình khám phá Đà Lạt 3 ngày 2 đêm',
        caption: 'Chia sẻ các quán cafe đẹp và điểm săn mây tuyệt vời',
      });

      expect(res.status).toBe(PostModerationStatus.PENDING);
      expect(res.tier).toBe('MANUAL_QUEUE');
    });

    it('Tier 2 Fast Clean (AI ON): should auto-approve clean travel posts with 0 AI tokens', async () => {
      mockRedis.get.mockResolvedValue('true');

      const res = await service.evaluatePostForCreation({
        title: 'Lịch trình khám phá Phú Quốc 4N3Đ tự túc',
        caption: 'Bãi Sao nước trong vắt, hải sản tươi ngon, người dân thân thiện',
        tags: ['#PhuQuoc', '#DuLichTuTuc'],
      });

      expect(res.status).toBe(PostModerationStatus.APPROVED);
      expect(res.tier).toBe('FAST_CLEAN');
    });

    it('Tier 3 Suspicious Trigger (AI ON + Mock Key Fallback): should flag ambiguous posts for Admin review', async () => {
      mockRedis.get.mockResolvedValue('true');

      const res = await service.evaluatePostForCreation({
        title: 'Cảnh báo lừa đảo đặt cọc phòng khách sạn qua Zalo',
        caption: 'Mọi người cẩn thận đừng chuyển khoản cọc trước nhé',
      });

      expect(res.status).toBe(PostModerationStatus.FLAGGED);
      expect(res.tier).toBe('FALLBACK_FLAGGED');
    });
  });

  describe('TikTok-Style Comment Moderation (Sync Door Guard + Async Post-Moderation)', () => {
    it('assertCommentAllowedSync should block hard profanity/gambling at the door', () => {
      expect(() =>
        service.assertCommentAllowedSync('Web cá độ tài xỉu uy tín nhất'),
      ).toThrow(BadRequestException);

      try {
        service.assertCommentAllowedSync('Đồ chó đẻ vcl');
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err.getResponse().code).toBe(
          ADMIN_ERROR_CODES.CONTENT_VIOLATES_POLICY,
        );
      }
    });

    it('assertCommentAllowedSync should allow normal and ambiguous comments through with 0ms delay', () => {
      expect(() =>
        service.assertCommentAllowedSync('Lịch trình chi tiết quá, cảm ơn bạn!'),
      ).not.toThrow();

      expect(() =>
        service.assertCommentAllowedSync('Quán này ngon chết mê, không chặt chém!'),
      ).not.toThrow();
    });
  });

  describe('Admin Approve & Reject Post Actions', () => {
    it('approvePost should set status to APPROVED, sync group post counts, and log audit', async () => {
      const mockTx = {
        communityPost: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'post-1',
            title: 'Review Hội An',
            moderationStatus: PostModerationStatus.PENDING,
            moderationNote: null,
            deletedAt: null,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'post-1',
            title: 'Review Hội An',
            moderationStatus: PostModerationStatus.APPROVED,
          }),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.approvePost(mockAdminUser, 'post-1', {
        reason: 'Nội dung tốt',
      });

      expect(result.success).toBe(true);
      expect(mockTx.communityPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
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
});
