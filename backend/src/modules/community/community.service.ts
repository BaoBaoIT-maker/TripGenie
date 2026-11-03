import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import {
  COMMUNITY_CONSTANTS,
  CommunitySortMode,
  SAFE_MEDIA_URL_REGEX,
} from './community.constants';
import {
  CreateCommunityCommentDto,
  CreateCommunityPostDto,
  QueryCommunityFeedDto,
  UpdateCommunityPostDto,
} from './dto/community.dto';
import {
  CommentContextResult,
  CommunityCommentView,
  CommunityPostView,
  CreatorProfileData,
  FeedPageResult,
  ICommunityRepository,
} from './interfaces/community-repository.interface';
import {
  IMediaStorageProvider,
  RawUploadFile,
  UploadedMediaItem,
} from './interfaces/media-storage.interface';

@Injectable()
export class CommunityService {
  constructor(
    @Inject(INJECT_TOKENS.COMMUNITY_REPOSITORY)
    private readonly communityRepository: ICommunityRepository,
    @Inject(INJECT_TOKENS.MEDIA_STORAGE_PROVIDER)
    private readonly mediaStorageProvider: IMediaStorageProvider,
  ) {}

  private normalizeTags(tags?: string[]): string[] {
    return Array.from(
      new Set(
        (tags ?? [])
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => (t.startsWith('#') ? t : `#${t}`)),
      ),
    ).slice(0, COMMUNITY_CONSTANTS.MAX_TAGS_COUNT);
  }

  private assertCanModifyPost(
    post: { userId: string },
    callerId: string,
    userRole: UserRole | undefined,
    actionName: string,
  ): void {
    const isOwner = post.userId === callerId;
    const isAdmin = userRole === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(`Bạn không có quyền ${actionName} này`);
    }
  }

  async uploadMedia(files: RawUploadFile[]): Promise<{
    mediaUrls: string[];
    items: UploadedMediaItem[];
  }> {
    const items = await this.mediaStorageProvider.saveFiles(files);
    return {
      mediaUrls: items.map((item) => item.url),
      items,
    };
  }

  async getFeed(
    query: QueryCommunityFeedDto,
    viewerId?: string,
  ): Promise<FeedPageResult> {
    // Defense in depth: DTO already validates HTTP input, but internal callers bypass it.
    const limit = Math.min(
      Math.max(1, query.limit ?? COMMUNITY_CONSTANTS.DEFAULT_FEED_LIMIT),
      COMMUNITY_CONSTANTS.MAX_FEED_LIMIT,
    );
    const sort = query.sort ?? CommunitySortMode.LATEST;

    return this.communityRepository.findFeedPosts({
      cursor: query.cursor,
      limit,
      sort,
      areaId: query.areaId,
      authorId: query.authorId,
      tag: query.tag?.trim() || undefined,
      search: query.search?.trim() || undefined,
      viewerId,
    });
  }

  async getPostById(postId: string, viewerId?: string): Promise<CommunityPostView> {
    const post = await this.communityRepository.findPostById(postId, viewerId);
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết hoặc bài viết đã bị xóa');
    }
    return post;
  }

  async createPost(
    userId: string,
    dto: CreateCommunityPostDto,
  ): Promise<CommunityPostView> {
    const trimmedTitle = (dto.title || '').trim();
    if (!trimmedTitle) {
      throw new BadRequestException('Tiêu đề bài viết không được để trống');
    }

    const sanitizedMediaUrls = (dto.mediaUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean);

    for (const url of sanitizedMediaUrls) {
      if (!SAFE_MEDIA_URL_REGEX.test(url)) {
        throw new BadRequestException(`Đường dẫn media không hợp lệ: "${url}"`);
      }
    }

    const normalizedTags = this.normalizeTags(dto.tags);

    if (dto.itineraryId) {
      const itineraryOwner = await this.communityRepository.findItineraryOwner(
        dto.itineraryId,
      );
      if (!itineraryOwner) {
        throw new NotFoundException('Không tìm thấy lịch trình đính kèm');
      }
      if (itineraryOwner.creatorId !== userId) {
        throw new ForbiddenException(
          'Bạn chỉ có thể đính kèm lịch trình thuộc quyền sở hữu của mình',
        );
      }
    }

    return this.communityRepository.createPost({
      userId,
      title: trimmedTitle,
      caption: dto.caption?.trim() || null,
      mediaUrls: sanitizedMediaUrls,
      tags: normalizedTags,
      itineraryId: dto.itineraryId ?? null,
    });
  }

  async updatePost(
    userId: string,
    userRole: UserRole | undefined,
    postId: string,
    dto: UpdateCommunityPostDto,
  ): Promise<CommunityPostView> {
    const post = await this.communityRepository.findPostById(postId, userId);
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết hoặc bài viết đã bị xóa');
    }

    this.assertCanModifyPost(post, userId, userRole, 'chỉnh sửa bài viết');

    const trimmedTitle = dto.title.trim();
    if (!trimmedTitle) {
      throw new BadRequestException('Tiêu đề không được để trống');
    }

    const normalizedTags = this.normalizeTags(dto.tags);

    return this.communityRepository.updatePost(
      postId,
      {
        title: trimmedTitle,
        caption: dto.caption?.trim() || null,
        tags: normalizedTags,
      },
      userId,
    );
  }

  async deletePost(
    userId: string,
    userRole: UserRole | undefined,
    postId: string,
  ): Promise<{ success: boolean; id: string }> {
    const post = await this.communityRepository.findPostById(postId, userId);
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết hoặc bài viết đã bị xóa');
    }

    this.assertCanModifyPost(post, userId, userRole, 'xóa bài viết');

    await this.communityRepository.softDeletePost(postId);
    return { success: true, id: postId };
  }

  async toggleLike(
    userId: string,
    postId: string,
  ): Promise<{ isLiked: boolean; likeCount: number; postId: string }> {
    const post = await this.communityRepository.findPostById(postId, userId);
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    const result = await this.communityRepository.togglePostLike(postId, userId);
    return {
      postId,
      ...result,
    };
  }

  async getPostComments(postId: string): Promise<CommunityCommentView[]> {
    const post = await this.communityRepository.findPostById(postId);
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    return this.communityRepository.findPostComments(postId);
  }

  async getCommentContext(
    postId: string,
    commentId: string,
  ): Promise<CommentContextResult> {
    const post = await this.communityRepository.findPostById(postId);
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    const context = await this.communityRepository.getCommentContext(postId, commentId);
    if (!context) {
      throw new NotFoundException('Không tìm thấy bình luận hoặc bình luận đã bị xóa');
    }

    return context;
  }

  async createComment(
    userId: string,
    postId: string,
    dto: CreateCommunityCommentDto,
  ): Promise<{ comment: CommunityCommentView; commentCount: number }> {
    const trimmed = (dto.content || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Nội dung bình luận không được để trống');
    }

    return this.communityRepository.createComment({
      postId,
      userId,
      content: trimmed,
      replyTargetCommentId: dto.parentId ?? null,
      replyToName: dto.replyToName ?? null,
    });
  }

  async deleteComment(
    userId: string,
    userRole: UserRole | undefined,
    commentId: string,
  ): Promise<{ success: boolean; commentId: string; postId: string; commentCount: number }> {
    const comment = await this.communityRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    const canDelete =
      comment.userId === userId ||
      comment.postOwnerId === userId ||
      userRole === UserRole.ADMIN;

    if (!canDelete) {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    const { commentCount } = await this.communityRepository.softDeleteComment(
      commentId,
      comment.postId,
    );

    return {
      success: true,
      commentId,
      postId: comment.postId,
      commentCount,
    };
  }

  async getCreatorProfile(
    targetUserIdOrUsername: string,
    viewerId?: string,
  ): Promise<CreatorProfileData> {
    const profile = await this.communityRepository.getCreatorProfile(
      targetUserIdOrUsername,
      viewerId,
    );

    if (!profile) {
      throw new NotFoundException('Không tìm thấy trang cá nhân của người dùng này');
    }

    return profile;
  }
}
