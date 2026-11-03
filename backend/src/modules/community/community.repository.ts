import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, NotificationType } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { writeNotification } from '../notifications/notification-writer';
import {
  COMMUNITY_CONSTANTS,
  FEED_SORT_STRATEGIES,
  UUID_REGEX,
} from './community.constants';
import {
  CommentAccessView,
  CommentContextResult,
  CommunityCommentView,
  CommunityLinkedItinerarySummary,
  CommunityPostView,
  CreateCommentData,
  CreatePostData,
  CreatorProfileData,
  FeedPageResult,
  FindFeedParams,
  ICommunityRepository,
  MatchedCreatorSummary,
} from './interfaces/community-repository.interface';
import {
  AUTHOR_SELECT,
  ITINERARY_SUMMARY_SELECT,
  mapAuthorSummary,
  mapCommentView,
  mapItinerarySummary,
  mapPostView,
} from './mappers/community.mapper';

@Injectable()
export class CommunityRepository implements ICommunityRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildPostInclude(viewerId?: string) {
    return {
      user: { select: AUTHOR_SELECT },
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

  // ponytail: unnest(p.tags) scan runs O(N_tags) with ILIKE. Upgrade to a GIN index on tags or dedicated community_tags table if feed volume > 100k posts.
  private async findMatchingTagsCaseInsensitive(term: string): Promise<string[]> {
    const clean = term.replace(/^#/, '').trim();
    if (!clean) return [];

    const rows = await this.prisma.$queryRaw<{ tag: string }[]>(Prisma.sql`
      SELECT DISTINCT unnest(tags) AS tag
      FROM community_posts
      WHERE "deletedAt" IS NULL
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
              where: { deletedAt: null },
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
    };

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
    const created = await this.prisma.$transaction(async (tx) => {
      if (data.itineraryId) {
        await tx.itinerary.update({
          where: { id: data.itineraryId },
          data: { isPublic: true },
        });
      }

      return tx.communityPost.create({
        data: {
          userId: data.userId,
          title: data.title,
          caption: data.caption ?? null,
          mediaUrls: data.mediaUrls,
          tags: data.tags,
          itineraryId: data.itineraryId ?? null,
        },
        include: this.buildPostInclude(data.userId),
      });
    });

    return mapPostView(created);
  }

  async updatePost(
    postId: string,
    data: { title: string; caption?: string | null; tags: string[] },
    viewerId?: string,
  ): Promise<CommunityPostView> {
    const updated = await this.prisma.communityPost.update({
      where: { id: postId },
      data: {
        title: data.title,
        caption: data.caption ?? null,
        tags: data.tags,
        editedAt: new Date(),
      },
      include: this.buildPostInclude(viewerId),
    });
    return mapPostView(updated);
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
      await tx.notification.deleteMany({
        where: { postId },
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
          postId,
          eventKey: `post-like:${postId}:${userId}`,
        });
      }

      return { isLiked: true, likeCount: updated.likeCount };
    });
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
        where: { id: comment.parentId, postId, deletedAt: null },
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

      // Notifications:
      // 1. Reply: notify target author with COMMENT_REPLIED (if not self).
      //    If post owner is someone else (not actor, not target author), notify post owner with POST_COMMENTED.
      // 2. Root comment: notify post owner with POST_COMMENTED (if not self).
      if (targetAuthorId) {
        if (targetAuthorId !== data.userId) {
          await writeNotification(tx, {
            recipientId: targetAuthorId,
            actorId: data.userId,
            type: NotificationType.COMMENT_REPLIED,
            postId: data.postId,
            commentId: created.id,
            eventKey: `comment-reply:${created.id}`,
          });
        }
        if (post.userId !== data.userId && post.userId !== targetAuthorId) {
          await writeNotification(tx, {
            recipientId: post.userId,
            actorId: data.userId,
            type: NotificationType.POST_COMMENTED,
            postId: data.postId,
            commentId: created.id,
            eventKey: `post-comment:${created.id}`,
          });
        }
      } else {
        if (post.userId !== data.userId) {
          await writeNotification(tx, {
            recipientId: post.userId,
            actorId: data.userId,
            type: NotificationType.POST_COMMENTED,
            postId: data.postId,
            commentId: created.id,
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
            commentId: { in: targetIds },
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
      where: { userId: user.id, deletedAt: null },
      _count: { _all: true },
      _sum: {
        likeCount: true,
        cloneCount: true,
      },
    });

    const postRows = await this.prisma.communityPost.findMany({
      where: { userId: user.id, deletedAt: null },
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

    return {
      user: {
        ...mapAuthorSummary(user),
        createdAt: user.createdAt,
      },
      stats: {
        postCount: aggregateStats._count._all ?? 0,
        totalLikesReceived: aggregateStats._sum.likeCount ?? 0,
        totalClonesReceived: aggregateStats._sum.cloneCount ?? 0,
        publicItineraryCount: itineraryRows.length,
      },
      posts: postRows.map((p) => mapPostView(p)),
      publicItineraries: itineraryRows
        .map((it) => mapItinerarySummary(it))
        .filter((it): it is CommunityLinkedItinerarySummary => it !== null),
    };
  }
}
