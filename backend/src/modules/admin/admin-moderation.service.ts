import {
  Injectable,
  Inject,
  Optional,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  PostModerationStatus,
  ReportStatus,
  AuditAction,
  UserRole,
} from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import Redis from 'ioredis';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import { NotificationTargetType } from '../notifications/notifications.constants';
import { AdminService } from './admin.service';
import {
  ADMIN_CONSTANTS,
  ADMIN_ERRORS,
  MODERATION_HARD_BLOCK_PATTERNS,
  MODERATION_SUSPICIOUS_PATTERNS,
} from './admin.constants';
import { AdminRequestMeta } from './dto/admin-users.dto';
import {
  AdminModeratePostDecisionDto,
  AdminResolveReportDto,
  QueryAdminModerationPostsDto,
  QueryAdminReportsDto,
} from './dto/admin-moderation.dto';

export interface ModerationEvaluationResult {
  status: PostModerationStatus;
  reason: string | null;
  tier: 'MANUAL_QUEUE' | 'HARD_BLOCKLIST' | 'FAST_CLEAN' | 'GEMINI_AI' | 'FALLBACK_FLAGGED' | 'FALLBACK_CLEAN';
}

@Injectable()
export class AdminModerationService {
  private readonly logger = new Logger(AdminModerationService.name);
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly baseUrl: string;
  private readonly httpClient: AxiosInstance;
  private fallbackAiEnabled = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    @Optional()
    private readonly configService?: ConfigService,
    @Optional()
    @Inject('REDIS_CLIENT')
    private readonly redisClient?: Redis,
  ) {
    this.apiKey = this.configService?.get<string>('GEMINI_API_KEY', '') ?? '';
    this.modelName =
      this.configService?.get<string>(
        'GEMINI_MODEL',
        ADMIN_CONSTANTS.MODERATION.DEFAULT_GEMINI_MODEL,
      ) ?? ADMIN_CONSTANTS.MODERATION.DEFAULT_GEMINI_MODEL;
    this.baseUrl =
      this.configService?.get<string>(
        'GEMINI_BASE_URL',
        ADMIN_CONSTANTS.MODERATION.DEFAULT_GEMINI_BASE_URL,
      ) ?? ADMIN_CONSTANTS.MODERATION.DEFAULT_GEMINI_BASE_URL;
    this.httpClient = axios.create({
      timeout: ADMIN_CONSTANTS.MODERATION.AI_TIMEOUT_MS,
    });
  }

  private resolvePagination(query: { page?: number; limit?: number }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(
      Math.max(query.limit ?? ADMIN_CONSTANTS.PAGINATION.DEFAULT_LIMIT, 1),
      ADMIN_CONSTANTS.PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  /**
   * Normalizes text to defeat simple leetspeak punctuation insertion (e.g. "l.ừ.a đ.ả.o" -> "lừa đảo").
   */
  private normalizeForModerationScan(text: string): string {
    return text
      .toLowerCase()
      .replace(/(\p{L})[._*-]+(?=\p{L})/gu, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tier 1: Checks if text matches hard blocklist (profanity, gambling, adult spam in VI & EN).
   */
  matchesHardBlocklist(text: string): boolean {
    const normalized = this.normalizeForModerationScan(text);
    return MODERATION_HARD_BLOCK_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    );
  }

  /**
   * Tier 2: Checks if text contains ambiguous/context-sensitive words that warrant AI contextual review.
   */
  matchesSuspiciousTriggers(text: string): boolean {
    const normalized = this.normalizeForModerationScan(text);
    return MODERATION_SUSPICIOUS_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    );
  }

  /**
   * Reads whether AI Auto-Moderation is currently enabled (Redis-backed with in-memory fallback).
   */
  async isAiModerationEnabled(): Promise<boolean> {
    if (this.redisClient) {
      try {
        const val = await this.redisClient.get(
          ADMIN_CONSTANTS.REDIS_KEYS.AI_MODERATION_ENABLED,
        );
        if (val === 'true') return true;
        if (val === 'false') return false;
      } catch (err) {
        this.logger.warn(
          `Redis read failed for AI moderation config, using fallback: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return this.fallbackAiEnabled;
  }

  /**
   * Returns current moderation configuration and pending/alert counts for Admin panel.
   */
  async getModerationConfig() {
    const [aiModerationEnabled, pendingPostsCount, flaggedPostsCount] =
      await Promise.all([
        this.isAiModerationEnabled(),
        this.prisma.communityPost.count({
          where: {
            deletedAt: null,
            moderationStatus: PostModerationStatus.PENDING,
          },
        }),
        this.prisma.communityPost.count({
          where: {
            deletedAt: null,
            moderationStatus: PostModerationStatus.FLAGGED,
          },
        }),
      ]);

    return {
      aiModerationEnabled,
      highPriorityReportThreshold:
        ADMIN_CONSTANTS.MODERATION.HIGH_PRIORITY_REPORT_THRESHOLD,
      pendingPostsCount,
      flaggedPostsCount,
    };
  }

  /**
   * Updates AI Auto-Moderation toggle in Redis and writes an AuditLog entry.
   */
  async updateModerationConfig(
    admin: AuthenticatedUser,
    aiModerationEnabled: boolean,
    meta?: AdminRequestMeta,
  ) {
    const previous = await this.isAiModerationEnabled();
    this.fallbackAiEnabled = aiModerationEnabled;

    if (this.redisClient) {
      try {
        await this.redisClient.set(
          ADMIN_CONSTANTS.REDIS_KEYS.AI_MODERATION_ENABLED,
          aiModerationEnabled ? 'true' : 'false',
        );
      } catch (err) {
        this.logger.warn(
          `Redis write failed for AI moderation config: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.adminService.logAudit({
      actorId: admin.id,
      actorRole: admin.role,
      action: AuditAction.UPDATE,
      targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.SYSTEM_SETTING,
      targetId: null,
      targetLabel: ADMIN_CONSTANTS.REDIS_KEYS.AI_MODERATION_ENABLED,
      beforeData: { aiModerationEnabled: previous },
      afterData: { aiModerationEnabled },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      notes: aiModerationEnabled
        ? 'Bật chế độ tự động kiểm duyệt nội dung bằng AI'
        : 'Tắt chế độ duyệt AI (chuyển sang duyệt thủ công 100%)',
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.UPDATE_MODERATION_CONFIG_SUCCESS,
      aiModerationEnabled,
    };
  }

  // ponytail: 3-tier text-only moderation funnel caps Gemini payload at <=1500 chars (~300 tokens) and 80 output tokens with 2.5s timeout; media is validated by URL regex & human report queue to prevent multimodal token explosion.
  private async evaluateWithGemini(
    text: string,
    hasSuspiciousTrigger: boolean,
  ): Promise<ModerationEvaluationResult> {
    const truncated = text.slice(
      0,
      ADMIN_CONSTANTS.MODERATION.MAX_AI_INPUT_CHARS,
    );

    if (!this.apiKey || this.apiKey === 'mock_key') {
      return hasSuspiciousTrigger
        ? {
            status: PostModerationStatus.FLAGGED,
            reason: ADMIN_CONSTANTS.MESSAGES.FALLBACK_FLAGGED_NOTE,
            tier: 'FALLBACK_FLAGGED',
          }
        : {
            status: PostModerationStatus.APPROVED,
            reason: ADMIN_CONSTANTS.MESSAGES.AUTO_APPROVED_CLEAN_NOTE,
            tier: 'FALLBACK_CLEAN',
          };
    }

    const endpoint = `${this.baseUrl}/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const prompt = [
      'Bạn là hệ thống kiểm duyệt cộng đồng du lịch TripGenie.',
      'Hãy phân tích văn bản sau (tiếng Việt hoặc tiếng Anh).',
      '- Nếu là chia sẻ du lịch, khen món ăn/cảnh đẹp (ví dụ "ngon chết mê", "không chặt chém") -> decision: "APPROVED".',
      '- Nếu là chửi bới, xúc phạm cá nhân/vùng miền, lừa đảo bán vé/đặt cọc, cờ bạc, khiêu dâm -> decision: "REJECTED".',
      '- Nếu nghi ngờ chưa rõ ràng -> decision: "FLAGGED".',
      'Chỉ trả về JSON: {"decision":"APPROVED"|"REJECTED"|"FLAGGED","reason":"lý do ngắn gọn tiếng Việt"}',
      `Văn bản: """${truncated}"""`,
    ].join('\n');

    try {
      const response = await this.httpClient.post(endpoint, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: ADMIN_CONSTANTS.MODERATION.MAX_AI_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
        },
      });

      const rawText: string =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = JSON.parse(rawText) as {
        decision?: string;
        reason?: string;
      };

      if (parsed.decision === 'REJECTED') {
        return {
          status: PostModerationStatus.REJECTED,
          reason:
            parsed.reason?.trim() ||
            ADMIN_CONSTANTS.MESSAGES.HARD_BLOCKLIST_REJECT_NOTE,
          tier: 'GEMINI_AI',
        };
      }

      if (parsed.decision === 'FLAGGED') {
        return {
          status: PostModerationStatus.FLAGGED,
          reason:
            parsed.reason?.trim() ||
            ADMIN_CONSTANTS.MESSAGES.FALLBACK_FLAGGED_NOTE,
          tier: 'GEMINI_AI',
        };
      }

      return {
        status: PostModerationStatus.APPROVED,
        reason:
          parsed.reason?.trim() ||
          ADMIN_CONSTANTS.MESSAGES.AUTO_APPROVED_CLEAN_NOTE,
        tier: 'GEMINI_AI',
      };
    } catch (err) {
      this.logger.warn(
        `Gemini moderation call failed/timed out, using safe fallback: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );

      return hasSuspiciousTrigger
        ? {
            status: PostModerationStatus.FLAGGED,
            reason: ADMIN_CONSTANTS.MESSAGES.FALLBACK_FLAGGED_NOTE,
            tier: 'FALLBACK_FLAGGED',
          }
        : {
            status: PostModerationStatus.APPROVED,
            reason: ADMIN_CONSTANTS.MESSAGES.AUTO_APPROVED_CLEAN_NOTE,
            tier: 'FALLBACK_CLEAN',
          };
    }
  }

  /**
   * Gatekeeper for new Community Posts:
   * - If AI Moderation is OFF -> status is PENDING (hidden until Admin manually approves).
   * - If AI Moderation is ON -> runs 3-tier funnel (Tier 1 Hard Block -> Tier 2/3 Contextual AI).
   */
  async evaluatePostForCreation(input: {
    title: string;
    caption?: string | null;
    tags?: string[];
  }): Promise<ModerationEvaluationResult> {
    const combinedText = [
      input.title,
      input.caption ?? '',
      (input.tags ?? []).join(' '),
    ]
      .join(' ')
      .trim();

    if (this.matchesHardBlocklist(combinedText)) {
      return {
        status: PostModerationStatus.REJECTED,
        reason: ADMIN_CONSTANTS.MESSAGES.HARD_BLOCKLIST_REJECT_NOTE,
        tier: 'HARD_BLOCKLIST',
      };
    }

    const aiEnabled = await this.isAiModerationEnabled();
    if (!aiEnabled) {
      return {
        status: PostModerationStatus.PENDING,
        reason: ADMIN_CONSTANTS.MESSAGES.PENDING_MANUAL_MODERATION_NOTE,
        tier: 'MANUAL_QUEUE',
      };
    }

    const hasSuspicious = this.matchesSuspiciousTriggers(combinedText);
    if (!hasSuspicious) {
      return {
        status: PostModerationStatus.APPROVED,
        reason: ADMIN_CONSTANTS.MESSAGES.AUTO_APPROVED_CLEAN_NOTE,
        tier: 'FAST_CLEAN',
      };
    }

    return this.evaluateWithGemini(combinedText, hasSuspicious);
  }

  /**
   * TikTok-style Comment Moderation (Part 1 - Sync at the door):
   * Blocks unambiguous profanity/gambling spam in 0.05ms before DB insert.
   */
  assertCommentAllowedSync(content: string): void {
    if (this.matchesHardBlocklist(content)) {
      throw new BadRequestException(ADMIN_ERRORS.CONTENT_VIOLATES_POLICY);
    }
  }

  /**
   * TikTok-style Comment Moderation (Part 2 - Async post-moderation):
   * Runs in background only if comment contains ambiguous/suspicious triggers.
   * If AI determines the comment is malicious, soft-deletes it and updates post commentCount.
   */
  async moderateCommentAsync(
    commentId: string,
    postId: string,
    content: string,
  ): Promise<void> {
    try {
      if (!this.matchesSuspiciousTriggers(content)) {
        return; // Clean comment -> 0 Gemini calls
      }

      const aiEnabled = await this.isAiModerationEnabled();
      if (!aiEnabled) {
        return;
      }

      const result = await this.evaluateWithGemini(content, true);
      if (result.status !== PostModerationStatus.REJECTED) {
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        const comment = await tx.postComment.findUnique({
          where: { id: commentId },
        });
        if (!comment || comment.deletedAt) return;

        await tx.postComment.update({
          where: { id: commentId },
          data: { deletedAt: new Date() },
        });

        await tx.notification.deleteMany({
          where: {
            targetType: NotificationTargetType.COMMENT,
            targetId: commentId,
          },
        });

        const activeCount = await tx.postComment.count({
          where: { postId, deletedAt: null },
        });

        await tx.communityPost.update({
          where: { id: postId },
          data: { commentCount: activeCount },
        });
      });
    } catch (err) {
      this.logger.warn(
        `Async comment moderation failed for comment ${commentId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async syncGroupPostCounts(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      UPDATE community_groups cg
      SET post_count = (
        SELECT COUNT(*)::int
        FROM community_posts cp
        WHERE cp.group_id = cg.id
          AND cp.deleted_at IS NULL
          AND cp.moderation_status = 'APPROVED'
      )
      WHERE cg.deleted_at IS NULL;
    `;
  }

  /**
   * Retrieves paginated posts in the moderation queue (PENDING, FLAGGED, REJECTED, APPROVED).
   */
  async getModerationPosts(query: QueryAdminModerationPostsDto) {
    const { page, limit, skip } = this.resolvePagination(query);

    const where: Prisma.CommunityPostWhereInput = {
      deletedAt: null,
    };

    if (query.status) {
      where.moderationStatus = query.status;
    }

    if (query.groupId) {
      where.groupId = query.groupId;
    }

    if (query.search) {
      const term = query.search.trim();
      if (term.length > 0) {
        where.OR = [
          { title: { contains: term, mode: 'insensitive' } },
          { caption: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.communityPost.count({ where }),
      this.prisma.communityPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              avatarUrl: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin approves a post -> transitions to APPROVED, syncs group post count, and logs Audit.
   */
  async approvePost(
    admin: AuthenticatedUser,
    postId: string,
    dto?: AdminModeratePostDecisionDto,
    meta?: AdminRequestMeta,
  ) {
    const updatedPost = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityPost.findUnique({
        where: { id: postId },
      });

      if (!existing || existing.deletedAt) {
        throw new NotFoundException(ADMIN_ERRORS.POST_NOT_FOUND);
      }

      const now = new Date();
      const note =
        dto?.reason?.trim() || 'Đã được phê duyệt bởi Quản trị viên';

      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: {
          moderationStatus: PostModerationStatus.APPROVED,
          moderationNote: note,
          moderatedAt: now,
        },
      });

      await this.syncGroupPostCounts(tx);

      await this.adminService.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.APPROVE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.COMMUNITY_POST,
          targetId: existing.id,
          targetLabel: existing.title,
          beforeData: {
            moderationStatus: existing.moderationStatus,
            moderationNote: existing.moderationNote,
          },
          afterData: {
            moderationStatus: PostModerationStatus.APPROVED,
            moderationNote: note,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: note,
        },
        tx,
      );

      return updated;
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.APPROVE_POST_SUCCESS,
      data: updatedPost,
    };
  }

  /**
   * Admin rejects a post -> transitions to REJECTED (hidden from public feed), syncs group post count, and logs Audit.
   */
  async rejectPost(
    admin: AuthenticatedUser,
    postId: string,
    dto: AdminModeratePostDecisionDto,
    meta?: AdminRequestMeta,
  ) {
    const updatedPost = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityPost.findUnique({
        where: { id: postId },
      });

      if (!existing || existing.deletedAt) {
        throw new NotFoundException(ADMIN_ERRORS.POST_NOT_FOUND);
      }

      const now = new Date();
      const note =
        dto?.reason?.trim() || 'Bị từ chối bởi Quản trị viên do vi phạm tiêu chuẩn cộng đồng';

      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: {
          moderationStatus: PostModerationStatus.REJECTED,
          moderationNote: note,
          moderatedAt: now,
        },
      });

      await this.syncGroupPostCounts(tx);

      await this.adminService.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.REJECT,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.COMMUNITY_POST,
          targetId: existing.id,
          targetLabel: existing.title,
          beforeData: {
            moderationStatus: existing.moderationStatus,
            moderationNote: existing.moderationNote,
          },
          afterData: {
            moderationStatus: PostModerationStatus.REJECTED,
            moderationNote: note,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: note,
        },
        tx,
      );

      return updated;
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.REJECT_POST_SUCCESS,
      data: updatedPost,
    };
  }

  /**
   * Anti-Brigading Report Center:
   * - Never auto-hides approved posts when reported.
   * - Aggregates report counts per target and flags High Priority Alert when reportCount >= 20.
   */
  async getModerationReports(query: QueryAdminReportsDto) {
    const { page, limit, skip } = this.resolvePagination(query);
    const threshold =
      ADMIN_CONSTANTS.MODERATION.HIGH_PRIORITY_REPORT_THRESHOLD;

    const where: Prisma.ContentReportWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.reportType) {
      where.reportType = query.reportType;
    }

    const groupedCounts = await this.prisma.contentReport.groupBy({
      by: ['targetType', 'targetId'],
      where: { status: ReportStatus.PENDING },
      _count: { _all: true },
    });

    const countMap = new Map<string, number>();
    let highPriorityAlertCount = 0;
    const highPriorityTargetIds: string[] = [];

    for (const g of groupedCounts) {
      const c = g._count._all ?? 0;
      countMap.set(`${g.targetType}:${g.targetId}`, c);
      if (c >= threshold) {
        highPriorityAlertCount += 1;
        highPriorityTargetIds.push(g.targetId);
      }
    }

    if (query.highPriorityOnly) {
      where.targetId = { in: highPriorityTargetIds };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.contentReport.count({ where }),
      this.prisma.contentReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          reporter: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const postTargetIds = Array.from(
      new Set(
        rows.filter((r) => r.targetType === 'POST').map((r) => r.targetId),
      ),
    );
    const targetPosts =
      postTargetIds.length > 0 && this.prisma.communityPost?.findMany
        ? ((await this.prisma.communityPost.findMany({
            where: { id: { in: postTargetIds } },
            select: {
              id: true,
              title: true,
              caption: true,
              mediaUrls: true,
              moderationStatus: true,
              commentCount: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  username: true,
                  avatarUrl: true,
                },
              },
              group: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          })) ?? [])
        : [];
    const postMap = new Map(targetPosts.map((p) => [p.id, p]));

    const items = rows.map((r) => {
      const targetReportCount =
        countMap.get(`${r.targetType}:${r.targetId}`) ?? 1;
      return {
        ...r,
        targetReportCount,
        isHighPriorityAlert: targetReportCount >= threshold,
        targetPost: postMap.get(r.targetId) ?? null,
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        highPriorityAlertCount,
        highPriorityReportThreshold: threshold,
      },
    };
  }

  /**
   * Resolves or dismisses content reports:
   * - RESOLVE: Closes reports as RESOLVED and (if rejectTargetPost !== false) rejects the reported post.
   * - DISMISS: Closes reports as DISMISSED (protects creator against mass-reporting brigading attacks).
   */
  async resolveReport(
    admin: AuthenticatedUser,
    reportId: string,
    dto: AdminResolveReportDto,
    meta?: AdminRequestMeta,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const report = await tx.contentReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        throw new NotFoundException(ADMIN_ERRORS.REPORT_NOT_FOUND);
      }

      const nextStatus =
        dto.action === 'RESOLVE'
          ? ReportStatus.RESOLVED
          : ReportStatus.DISMISSED;
      const now = new Date();
      const note =
        dto.resolutionNote?.trim() ||
        (dto.action === 'RESOLVE'
          ? 'Báo cáo hợp lệ — Đã xử lý nội dung vi phạm'
          : 'Bác bỏ báo cáo — Nội dung không vi phạm');

      await tx.contentReport.updateMany({
        where: {
          targetType: report.targetType,
          targetId: report.targetId,
          status: ReportStatus.PENDING,
        },
        data: {
          status: nextStatus,
          reviewedBy: admin.id,
          reviewedAt: now,
          resolutionNote: note,
        },
      });

      if (
        dto.action === 'RESOLVE' &&
        dto.rejectTargetPost !== false &&
        report.targetType === 'POST'
      ) {
        await tx.communityPost.updateMany({
          where: { id: report.targetId },
          data: {
            moderationStatus: PostModerationStatus.REJECTED,
            moderationNote: note,
            moderatedAt: now,
          },
        });
        await this.syncGroupPostCounts(tx);
      }

      await this.adminService.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action:
            dto.action === 'RESOLVE'
              ? AuditAction.REJECT
              : AuditAction.APPROVE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.CONTENT_REPORT,
          targetId: report.id,
          targetLabel: `${report.targetType}:${report.targetId}`,
          beforeData: { status: report.status },
          afterData: {
            status: nextStatus,
            action: dto.action,
            resolutionNote: note,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: note,
        },
        tx,
      );
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.RESOLVE_REPORT_SUCCESS,
      reportId,
    };
  }
}
