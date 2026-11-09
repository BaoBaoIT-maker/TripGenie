import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  NotificationType,
  PostModerationStatus,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { writeNotification } from '../notifications/notification-writer';
import { NotificationTargetType } from '../notifications/notifications.constants';
import {
  COMMUNITY_CONSTANTS,
  FEED_SORT_STRATEGIES,
  UUID_REGEX,
} from './community.constants';
import {
  CommentAccessView,
  CommentContextResult,
  CommunityCommentView,
  CommunityGroupSummary,
  CommunityLinkedItinerarySummary,
  CommunityPostView,
  CreateCommentData,
  CreateCommunityGroupData,
  CreatePostData,
  CreatePostReportData,
  CreatorProfileData,
  FeedPageResult,
  FindFeedParams,
  ICommunityRepository,
  MatchedCreatorSummary,
  PostReportResult,
  SidebarDiscoveryData,
  TopCreatorSummary,
} from './interfaces/community-repository.interface';
import {
  AUTHOR_SELECT,
  GROUP_MINI_SELECT,
  GROUP_SUMMARY_SELECT,
  ITINERARY_SUMMARY_SELECT,
  mapAuthorSummary,
  mapCommentView,
  mapGroupSummary,
  mapItinerarySummary,
  mapPostView,
} from './mappers/community.mapper';

@Injectable()
export class CommunityRepository implements ICommunityRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildPostInclude(viewerId?: string) {
    return {
      user: { select: AUTHOR_SELECT },
      group: { select: GROUP_MINI_SELECT },
      itinerary: { select: ITINERARY_SUMMARY_SELECT },
      likes: viewerId
        ? {
            where: { userId: viewerId },
            select: { userId: true },
            take: COMMUNITY_CONSTANTS.VIEWER_LIKE_LOOKUP_LIMIT,
          }
        : false,
    } satisfies Prisma.CommunityPostInclude;
  }

  private async syncGroupPostCounts(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      UPDATE community_groups cg
      SET post_count = CASE
        WHEN cg.is_default = true THEN (
          SELECT COUNT(*)::int FROM community_posts cp
          WHERE cp.deleted_at IS NULL AND cp.moderation_status = 'APPROVED'
        )
        ELSE (
          SELECT COUNT(*)::int FROM community_posts cp
          WHERE cp.group_id = cg.id AND cp.deleted_at IS NULL AND cp.moderation_status = 'APPROVED'
        )
      END;
    `;
  }

  async findActiveGroups(): Promise<CommunityGroupSummary[]> {
    const rows = await this.prisma.communityGroup.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: GROUP_SUMMARY_SELECT,
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((r) => mapGroupSummary(r));
  }

  async findGroupByIdOrSlug(
    identifier: string,
  ): Promise<CommunityGroupSummary | null> {
    const clean = identifier.trim();
    if (!clean) return null;
    const isUuid = UUID_REGEX.test(clean);

    const row = await this.prisma.communityGroup.findFirst({
      where: {
        ...(isUuid ? { id: clean } : { slug: clean }),
        isActive: true,
        deletedAt: null,
      },
      select: GROUP_SUMMARY_SELECT,
    });

    return row ? mapGroupSummary(row) : null;
  }

  async findDefaultGroup(): Promise<CommunityGroupSummary | null> {
    const row = await this.prisma.communityGroup.findFirst({
      where: {
        isDefault: true,
        isActive: true,
        deletedAt: null,
      },
      select: GROUP_SUMMARY_SELECT,
      orderBy: { sortOrder: 'asc' },
    });

    return row ? mapGroupSummary(row) : null;
  }

  async createCommunityGroup(
    data: CreateCommunityGroupData,
  ): Promise<CommunityGroupSummary> {
    const created = await this.prisma.communityGroup.create({
      data: {
        name: data.name,
        slug: data.slug,
        subtitle: data.subtitle ?? null,
        description: data.description ?? null,
        iconUrl: data.iconUrl ?? null,
        coverUrl: data.coverUrl ?? null,
        isDefault: Boolean(data.isDefault),
        sortOrder: data.sortOrder ?? 0,
        createdBy: data.createdBy,
      },
      select: GROUP_SUMMARY_SELECT,
    });

    return mapGroupSummary(created);
  }

  private async findTopCreatorsForSidebar(): Promise<TopCreatorSummary[]> {
    const grouped = await this.prisma.communityPost.groupBy({
      by: ['userId'],
      where: {
        deletedAt: null,
        moderationStatus: PostModerationStatus.APPROVED,
      },
      _count: { _all: true },
      _sum: {
        likeCount: true,
        cloneCount: true,
      },
    });

    if (grouped.length === 0) return [];

    const ranked = grouped
      .map((g) => {
        const postCount = g._count._all ?? 0;
        const totalLikesReceived = g._sum.likeCount ?? 0;
        const totalClonesReceived = g._sum.cloneCount ?? 0;
        const score = totalClonesReceived * 3 + totalLikesReceived + postCount * 5;
        return {
          userId: g.userId,
          postCount,
          totalLikesReceived,
          totalClonesReceived,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, COMMUNITY_CONSTANTS.TOP_CREATORS_SIDEBAR_LIMIT);

    const userIds = ranked.map((r) => r.userId);
    const [users, publicItinerariesByCreator] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          deletedAt: null,
          isActive: true,
        },
        select: AUTHOR_SELECT,
      }),
      this.prisma.itinerary.groupBy({
        by: ['creatorId'],
        where: {
          creatorId: { in: userIds },
          isPublic: true,
          deletedAt: null,
        },
        _count: { _all: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const itinCountMap = new Map(
      publicItinerariesByCreator.map((it) => [it.creatorId, it._count._all ?? 0]),
    );

    const results: TopCreatorSummary[] = [];
    for (const item of ranked) {
      const u = userMap.get(item.userId);
      if (!u) continue;
      const authorSummary = mapAuthorSummary(u, {
        postCount: item.postCount,
        totalLikesReceived: item.totalLikesReceived,
        totalClonesReceived: item.totalClonesReceived,
      });
      results.push({
        ...authorSummary,
        author: authorSummary,
        postCount: item.postCount,
        publicItineraryCount: itinCountMap.get(item.userId) ?? 0,
        totalLikesReceived: item.totalLikesReceived,
        totalClonesReceived: item.totalClonesReceived,
      });
    }

    return results;
  }

  async getSidebarDiscovery(viewerId?: string): Promise<SidebarDiscoveryData> {
    const [groups, topClonedRows, checkinHighlightRows, topCreators] =
      await Promise.all([
        this.findActiveGroups(),
        this.prisma.communityPost.findMany({
          where: {
            deletedAt: null,
            moderationStatus: PostModerationStatus.APPROVED,
            itineraryId: { not: null },
          },
          orderBy: [
            { cloneCount: 'desc' },
            { likeCount: 'desc' },
            { createdAt: 'desc' },
          ],
          take: COMMUNITY_CONSTANTS.TOP_CLONED_SIDEBAR_LIMIT,
          include: this.buildPostInclude(viewerId),
        }),
        this.prisma.communityPost.findMany({
          where: {
            deletedAt: null,
            moderationStatus: PostModerationStatus.APPROVED,
            NOT: { mediaUrls: { equals: [] } },
          },
          orderBy: [{ createdAt: 'desc' }, { likeCount: 'desc' }],
          take: COMMUNITY_CONSTANTS.CHECKIN_HIGHLIGHTS_LIMIT,
          include: this.buildPostInclude(viewerId),
        }),
        this.findTopCreatorsForSidebar(),
      ]);

    return {
      groups,
      topClonedPosts: topClonedRows.map((r) => mapPostView(r)),
      checkinHighlights: checkinHighlightRows.map((r) => mapPostView(r)),
      topCreators,
    };
  }

  // ponytail: unnest(p.tags) scan runs O(N_tags) with ILIKE. Upgrade to a GIN index on tags or dedicated community_tags table if feed volume > 100k posts.
  private async findMatchingTagsCaseInsensitive(term: string): Promise<string[]> {
    const clean = term.replace(/^#/, '').trim();
    if (!clean) return [];

    const rows = await this.prisma.$queryRaw<{ tag: string }[]>(Prisma.sql`
      SELECT DISTINCT unnest(tags) AS tag
      FROM community_posts
      WHERE deleted_at IS NULL
        AND moderation_status = 'APPROVED'
        AND EXISTS (
          SELECT 1
          FROM unnest(tags) t
          WHERE t ILIKE ${'%' + clean + '%'}
        )
      LIMIT 10;
    `);

    return rows.map((r) => r.tag);
  }

  // ponytail: ILIKE substring scan on Creator fullname/username. In future, back with pg_trgm trigram index if creator count > 10k.
  private async findMatchedCreators(
    q: string,
  ): Promise<MatchedCreatorSummary[]> {
    const cleanHandle = q.replace(/^@/, '').trim();
    if (!cleanHandle) return [];

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { fullName: { contains: cleanHandle, mode: 'insensitive' } },
          { username: { contains: cleanHandle, mode: 'insensitive' } },
        ],
      },
      select: {
        ...AUTHOR_SELECT,
        _count: {
          select: {
            posts: {
              where: {
                deletedAt: null,
                moderationStatus: PostModerationStatus.APPROVED,
              },
            },
          },
        },
      },
      take: COMMUNITY_CONSTANTS.MATCHED_CREATORS_LIMIT,
    });

    return users.map((u) => ({
      ...mapAuthorSummary(u),
      postCount: u._count.posts,
    }));
  }

  // ponytail: ILIKE substring search bypasses btree index. Upgrade to PostgreSQL pg_trgm GIN index or full-text tsvector when post corpus exceeds 50k items.
  private async buildSearchConditions(
    q: string,
  ): Promise<Prisma.CommunityPostWhereInput[]> {
    const cleanHandle = q.replace(/^@/, '').trim();
    const cleanTag = q.replace(/^#/, '').trim();
    const hashTag = `#${cleanTag}`;
    const matchedTags = await this.findMatchingTagsCaseInsensitive(cleanTag);

    return [
      { title: { contains: q, mode: 'insensitive' } },
      { caption: { contains: q, mode: 'insensitive' } },
      {
        tags: {
          hasSome: Array.from(new Set([q, hashTag, ...matchedTags])),
        },
      },
      {
        user: {
          is: {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              ...(cleanHandle
                ? [{ username: { contains: cleanHandle, mode: 'insensitive' as const } }]
                : []),
            ],
          },
        },
      },
      {
        itinerary: {
          is: {
            deletedAt: null,
            OR: [
              { destination: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
              { area: { is: { nameVi: { contains: q, mode: 'insensitive' } } } },
            ],
          },
        },
      },
    ];
  }

  private async buildFeedWhere(
    params: FindFeedParams,
  ): Promise<{ where: Prisma.CommunityPostWhereInput; matchedCreators?: MatchedCreatorSummary[] }> {
    const where: Prisma.CommunityPostWhereInput = {
      deletedAt: null,
      moderationStatus: PostModerationStatus.APPROVED,
    };

    if (params.groupId) {
      const group = await this.findGroupByIdOrSlug(params.groupId);
      if (group && !group.isDefault) {
        where.groupId = group.id;
      }
    }

    if (params.authorId) {
      where.userId = params.authorId;
    }

    if (params.areaId) {
      where.itinerary = {
        is: {
          deletedAt: null,
          areaId: params.areaId,
        },
      };
    }

    if (params.tag) {
      const cleanTag = params.tag.replace(/^#/, '').trim();
      const hashTag = `#${cleanTag}`;
      const matched = await this.findMatchingTagsCaseInsensitive(cleanTag);
      where.tags = {
        hasSome: Array.from(new Set([cleanTag, hashTag, ...matched])),
      };
    }

    let matchedCreators: MatchedCreatorSummary[] | undefined;

    if (params.search) {
      const conditions = await this.buildSearchConditions(params.search);
      where.OR = conditions;
      matchedCreators = await this.findMatchedCreators(params.search);
    }

    return { where, matchedCreators };
  }

  async findFeedPosts(params: FindFeedParams): Promise<FeedPageResult> {
    const { where, matchedCreators } = await this.buildFeedWhere(params);

    const orderBy =
      FEED_SORT_STRATEGIES[params.sort] || FEED_SORT_STRATEGIES.LATEST;

    const rows = await this.prisma.communityPost.findMany({
      where,
      orderBy,
      take: params.limit + 1,
      include: this.buildPostInclude(params.viewerId),
      ...(params.cursor
        ? {
            cursor: { id: params.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasNextPage = rows.length > params.limit;
    const pageRows = hasNextPage ? rows.slice(0, params.limit) : rows;
    const nextCursor =
      hasNextPage && pageRows.length > 0
        ? pageRows[pageRows.length - 1].id
        : null;

    return {
      items: pageRows.map((r) => mapPostView(r)),
      nextCursor,
      ...(matchedCreators ? { matchedCreators } : {}),
    };
  }

  async findPostById(postId: string, viewerId?: string): Promise<CommunityPostView | null> {
    const row = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null },
      include: this.buildPostInclude(viewerId),
    });

    return row ? mapPostView(row) : null;
  }

  async findItineraryOwner(
    itineraryId: string,
  ): Promise<{ id: string; creatorId: string } | null> {
    return this.prisma.itinerary.findFirst({
      where: { id: itineraryId, deletedAt: null },
      select: { id: true, creatorId: true },
    });
  }

  async createPost(data: CreatePostData): Promise<CommunityPostView> {
    const createdId = await this.prisma.$transaction(async (tx) => {
      if (data.itineraryId) {
        await tx.itinerary.update({
          where: { id: data.itineraryId },
          data: { isPublic: true },
        });
      }

      const post = await tx.communityPost.create({
        data: {
          userId: data.userId,
          groupId: data.groupId ?? null,
          title: data.title,
          caption: data.caption ?? null,
          mediaUrls: data.mediaUrls,
          tags: data.tags,
          itineraryId: data.itineraryId ?? null,
          moderationStatus: PostModerationStatus.APPROVED,
        },
        select: { id: true },
      });

      await this.syncGroupPostCounts(tx);

      return post.id;
    });

    const view = await this.findPostById(createdId, data.userId);
    return view!;
  }

  async updatePost(
    postId: string,
    data: {
      title: string;
      caption?: string | null;
      tags: string[];
      groupId?: string | null;
    },
    viewerId?: string,
  ): Promise<CommunityPostView> {
    await this.prisma.$transaction(async (tx) => {
      await tx.communityPost.update({
        where: { id: postId },
        data: {
          title: data.title,
          caption: data.caption ?? null,
          tags: data.tags,
          ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
          editedAt: new Date(),
        },
        select: { id: true },
      });

      if (data.groupId !== undefined) {
        await this.syncGroupPostCounts(tx);
      }
    });

    const view = await this.findPostById(postId, viewerId);
    return view!;
  }

  async softDeletePost(postId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const post = await tx.communityPost.findUnique({
        where: { id: postId },
        select: { itineraryId: true },
      });

      await tx.communityPost.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });
      const comments = await tx.postComment.findMany({
        where: { postId },
        select: { id: true },
      });
      const commentIds = comments.map((c) => c.id);

      await tx.notification.deleteMany({
        where: {
          OR: [
            { targetType: NotificationTargetType.POST, targetId: postId },
            { postId },
            ...(commentIds.length > 0
              ? [
                  { targetType: NotificationTargetType.COMMENT, targetId: { in: commentIds } },
                  { commentId: { in: commentIds } },
                ]
              : []),
          ],
        },
      });

      if (post?.itineraryId) {
        const remainingActivePosts = await tx.communityPost.count({
          where: {
            itineraryId: post.itineraryId,
            deletedAt: null,
          },
        });
        if (remainingActivePosts === 0) {
          await tx.itinerary.update({
            where: { id: post.itineraryId },
            data: { isPublic: false },
          });
        }
      }

      await this.syncGroupPostCounts(tx);
    });
  }

  // ponytail: atomic Postgres row-level counter handles ~2k likes/sec; upgrade to Redis write-behind buffer only if single-post viral contention > 5k req/s.
  async togglePostLike(
    postId: string,
    userId: string,
  ): Promise<{ isLiked: boolean; likeCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const existingLike = await tx.postLike.findUnique({
        where: {
          postId_userId: { postId, userId },
        },
      });

      const post = await tx.communityPost.findUnique({
        where: { id: postId },
        select: { userId: true },
      });
      if (!post) {
        throw new NotFoundException('Không tìm thấy bài viết');
      }

      if (existingLike) {
        await tx.postLike.delete({
          where: {
            postId_userId: { postId, userId },
          },
        });
        const updated = await tx.communityPost.update({
          where: { id: postId },
          data: {
            likeCount: { decrement: 1 },
          },
          select: { likeCount: true },
        });

        // Delete like notification if exists
        await tx.notification.deleteMany({
          where: {
            recipientId: post.userId,
            eventKey: `post-like:${postId}:${userId}`,
          },
        });

        const safeLikeCount = Math.max(0, updated.likeCount);
        if (updated.likeCount < 0) {
          await tx.communityPost.update({
            where: { id: postId },
            data: { likeCount: 0 },
          });
        }

        return { isLiked: false, likeCount: safeLikeCount };
      }

      await tx.postLike.create({
        data: { postId, userId },
      });
      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: {
          likeCount: { increment: 1 },
        },
        select: { likeCount: true },
      });

      // Write notification for post owner if not self-like
      if (post.userId !== userId) {
        await writeNotification(tx, {
          recipientId: post.userId,
          actorId: userId,
          type: NotificationType.POST_LIKED,
          targetType: NotificationTargetType.POST,
          targetId: postId,
          eventKey: `post-like:${postId}:${userId}`,
        });
      }

      return { isLiked: true, likeCount: updated.likeCount };
    });
  }

  async reportPost(data: CreatePostReportData): Promise<PostReportResult> {
    const existing = await this.prisma.contentReport.findFirst({
      where: {
        targetType: ReportTargetType.POST,
        targetId: data.postId,
        reportedBy: data.reportedBy,
        status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWING] },
      },
      select: {
        id: true,
        reportType: true,
        status: true,
      },
    });

    if (existing) {
      return {
        id: existing.id,
        postId: data.postId,
        reportType: existing.reportType,
        status: existing.status,
        alreadyReported: true,
      };
    }

    const created = await this.prisma.contentReport.create({
      data: {
        reportedBy: data.reportedBy,
        targetType: ReportTargetType.POST,
        targetId: data.postId,
        reportType: data.reportType,
        description: data.description ?? null,
        status: ReportStatus.PENDING,
      },
      select: {
        id: true,
        reportType: true,
        status: true,
      },
    });

    return {
      id: created.id,
      postId: data.postId,
      reportType: created.reportType,
      status: created.status,
      alreadyReported: false,
    };
  }

  async findPostComments(
    postId: string,
    limit: number = COMMUNITY_CONSTANTS.DEFAULT_COMMENTS_LIMIT,
  ): Promise<CommunityCommentView[]> {
    const rows = await this.prisma.postComment.findMany({
      where: { postId, deletedAt: null },
      include: {
        user: { select: AUTHOR_SELECT },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return rows.map((r) => mapCommentView(r));
  }

  async findCommentById(commentId: string): Promise<CommentAccessView | null> {
    const comment = await this.prisma.postComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: {
        id: true,
        postId: true,
        userId: true,
        parentId: true,
        user: {
          select: { fullName: true },
        },
        post: {
          select: { userId: true },
        },
      },
    });

    if (!comment) return null;

    return {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      postOwnerId: comment.post.userId,
      parentId: comment.parentId ?? null,
      authorFullName: comment.user.fullName,
    };
  }

  async getCommentContext(
    postId: string,
    commentId: string,
  ): Promise<CommentContextResult | null> {
    const comment = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId, deletedAt: null },
      include: {
        user: { select: AUTHOR_SELECT },
      },
    });

    if (!comment) return null;

    let parent: CommunityCommentView | null = null;
    if (comment.parentId) {
      const parentRow = await this.prisma.postComment.findFirst({
        where: { id: commentId === comment.parentId ? undefined : comment.parentId, postId, deletedAt: null },
        include: {
          user: { select: AUTHOR_SELECT },
        },
      });
      if (parentRow) {
        parent = mapCommentView(parentRow);
      }
    }

    return {
      comment: mapCommentView(comment),
      parent,
    };
  }

  async createComment(
    data: CreateCommentData,
  ): Promise<{ comment: CommunityCommentView; commentCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.communityPost.findFirst({
        where: { id: data.postId, deletedAt: null },
        select: { id: true, userId: true },
      });
      if (!post) {
        throw new NotFoundException('Không tìm thấy bài viết hoặc bài viết đã bị xóa');
      }

      let effectiveParentId: string | null = null;
      let effectiveReplyToName: string | null = null;
      let targetAuthorId: string | null = null;

      if (data.replyTargetCommentId) {
        const targetComment = await tx.postComment.findFirst({
          where: {
            id: data.replyTargetCommentId,
            postId: data.postId,
            deletedAt: null,
          },
          select: {
            id: true,
            userId: true,
            parentId: true,
            user: { select: { fullName: true } },
          },
        });

        if (!targetComment) {
          throw new NotFoundException('Không tìm thấy bình luận gốc để trả lời');
        }

        effectiveParentId = targetComment.parentId || targetComment.id;
        effectiveReplyToName =
          data.replyToName?.trim() || targetComment.user.fullName;
        targetAuthorId = targetComment.userId;
      }

      const created = await tx.postComment.create({
        data: {
          postId: data.postId,
          userId: data.userId,
          content: data.content,
          parentId: effectiveParentId,
          replyToName: effectiveReplyToName,
        },
        include: {
          user: { select: AUTHOR_SELECT },
        },
      });

      if (targetAuthorId) {
        if (targetAuthorId !== data.userId) {
          await writeNotification(tx, {
            recipientId: targetAuthorId,
            actorId: data.userId,
            type: NotificationType.COMMENT_REPLIED,
            targetType: NotificationTargetType.COMMENT,
            targetId: created.id,
            eventKey: `comment-reply:${created.id}`,
          });
        }
        if (post.userId !== data.userId && post.userId !== targetAuthorId) {
          await writeNotification(tx, {
            recipientId: post.userId,
            actorId: data.userId,
            type: NotificationType.POST_COMMENTED,
            targetType: NotificationTargetType.COMMENT,
            targetId: created.id,
            eventKey: `post-comment:${created.id}`,
          });
        }
      } else {
        if (post.userId !== data.userId) {
          await writeNotification(tx, {
            recipientId: post.userId,
            actorId: data.userId,
            type: NotificationType.POST_COMMENTED,
            targetType: NotificationTargetType.COMMENT,
            targetId: created.id,
            eventKey: `post-comment:${created.id}`,
          });
        }
      }

      const activeCount = await tx.postComment.count({
        where: { postId: data.postId, deletedAt: null },
      });

      const updatedPost = await tx.communityPost.update({
        where: { id: data.postId },
        data: { commentCount: activeCount },
        select: { commentCount: true },
      });

      return {
        comment: mapCommentView(created),
        commentCount: updatedPost.commentCount,
      };
    });
  }

  async softDeleteComment(
    commentId: string,
    postId: string,
  ): Promise<{ commentCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const targets = await tx.postComment.findMany({
        where: {
          postId,
          deletedAt: null,
          OR: [{ id: commentId }, { parentId: commentId }],
        },
        select: { id: true },
      });
      const targetIds = targets.map((t) => t.id);

      await tx.postComment.updateMany({
        where: {
          id: { in: targetIds },
        },
        data: { deletedAt: now },
      });

      if (targetIds.length > 0) {
        await tx.notification.deleteMany({
          where: {
            OR: [
              { targetType: NotificationTargetType.COMMENT, targetId: { in: targetIds } },
              { commentId: { in: targetIds } },
            ],
          },
        });
      }

      const activeCount = await tx.postComment.count({
        where: { postId, deletedAt: null },
      });

      await tx.communityPost.update({
        where: { id: postId },
        data: { commentCount: activeCount },
      });

      return { commentCount: activeCount };
    });
  }

  async getCreatorProfile(
    targetUserIdOrUsername: string,
    viewerId?: string,
  ): Promise<CreatorProfileData | null> {
    const cleanIdentifier = targetUserIdOrUsername.replace(/^@/, '').trim();
    const isUuid = UUID_REGEX.test(cleanIdentifier);

    const user = await this.prisma.user.findFirst({
      where: {
        ...(isUuid ? { id: cleanIdentifier } : { username: cleanIdentifier }),
        deletedAt: null,
        isActive: true,
      },
      select: {
        ...AUTHOR_SELECT,
        createdAt: true,
      },
    });

    if (!user) return null;

    const aggregateStats = await this.prisma.communityPost.aggregate({
      where: {
        userId: user.id,
        deletedAt: null,
        moderationStatus: PostModerationStatus.APPROVED,
      },
      _count: { _all: true },
      _sum: {
        likeCount: true,
        cloneCount: true,
      },
    });

    const postRows = await this.prisma.communityPost.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        moderationStatus: PostModerationStatus.APPROVED,
      },
      include: this.buildPostInclude(viewerId),
      orderBy: { createdAt: 'desc' },
      take: COMMUNITY_CONSTANTS.MAX_FEED_LIMIT,
    });

    const itineraryRows = await this.prisma.itinerary.findMany({
      where: {
        creatorId: user.id,
        isPublic: true,
        deletedAt: null,
      },
      select: ITINERARY_SUMMARY_SELECT,
      orderBy: { createdAt: 'desc' },
      take: COMMUNITY_CONSTANTS.MAX_FEED_LIMIT,
    });

    const stats = {
      postCount: aggregateStats._count._all ?? 0,
      totalLikesReceived: aggregateStats._sum.likeCount ?? 0,
      totalClonesReceived: aggregateStats._sum.cloneCount ?? 0,
      publicItineraryCount: itineraryRows.length,
    };

    return {
      user: {
        ...mapAuthorSummary(user, stats),
        createdAt: user.createdAt,
      },
      stats,
      posts: postRows.map((p) => mapPostView(p)),
      publicItineraries: itineraryRows
        .map((it) => mapItinerarySummary(it))
        .filter((it): it is CommunityLinkedItinerarySummary => it !== null),
    };
  }
}
