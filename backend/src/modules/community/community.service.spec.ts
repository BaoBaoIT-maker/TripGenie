import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { CommunityService } from './community.service';
import { CommunitySortMode } from './community.constants';

describe('CommunityService', () => {
  let service: CommunityService;
  let mockRepo: {
    findFeedPosts: jest.Mock;
    findPostById: jest.Mock;
    findItineraryOwner: jest.Mock;
    createPost: jest.Mock;
    updatePost: jest.Mock;
    softDeletePost: jest.Mock;
    togglePostLike: jest.Mock;
    findPostComments: jest.Mock;
    findCommentById: jest.Mock;
    createComment: jest.Mock;
    softDeleteComment: jest.Mock;
    getCreatorProfile: jest.Mock;
  };
  let mockStorage: {
    saveFiles: jest.Mock;
    deleteFile: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findFeedPosts: jest.fn(),
      findPostById: jest.fn(),
      findItineraryOwner: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn(),
      softDeletePost: jest.fn(),
      togglePostLike: jest.fn(),
      findPostComments: jest.fn(),
      findCommentById: jest.fn(),
      createComment: jest.fn(),
      softDeleteComment: jest.fn(),
      getCreatorProfile: jest.fn(),
    };

    mockStorage = {
      saveFiles: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        {
          provide: INJECT_TOKENS.COMMUNITY_REPOSITORY,
          useValue: mockRepo,
        },
        {
          provide: INJECT_TOKENS.MEDIA_STORAGE_PROVIDER,
          useValue: mockStorage,
        },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadMedia', () => {
    it('should delegate file saving to IMediaStorageProvider and return mediaUrls', async () => {
      mockStorage.saveFiles.mockResolvedValue([
        {
          url: '/api/v1/uploads/community/file-1.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
          mediaType: 'IMAGE',
        },
      ]);

      const result = await service.uploadMedia([
        {
          originalname: 'test.png',
          mimetype: 'image/png',
          size: 1024,
          buffer: Buffer.from('test'),
        },
      ]);

      expect(mockStorage.saveFiles).toHaveBeenCalledTimes(1);
      expect(result.mediaUrls).toEqual(['/api/v1/uploads/community/file-1.png']);
    });
  });

  describe('createPost', () => {
    it('should reject unsafe media URLs (e.g., javascript: scheme)', async () => {
      await expect(
        service.createPost('user-1', {
          title: 'Chuyến đi Đà Lạt',
          mediaUrls: ['javascript:alert(1)'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should forbid attaching an itinerary owned by another user (Trust Boundary check)', async () => {
      mockRepo.findItineraryOwner.mockResolvedValue({
        id: 'itin-b',
        creatorId: 'user-b',
      });

      await expect(
        service.createPost('user-a', {
          title: 'Bài đăng giả mạo lịch trình',
          itineraryId: 'itin-b',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should normalize hashtags and create post when itinerary belongs to caller', async () => {
      mockRepo.findItineraryOwner.mockResolvedValue({
        id: 'itin-a',
        creatorId: 'user-a',
      });
      mockRepo.createPost.mockResolvedValue({
        id: 'post-1',
        userId: 'user-a',
        title: 'Đà Lạt 3N2Đ',
        tags: ['#DaLat', '#SanMay'],
      });

      const result = await service.createPost('user-a', {
        title: '  Đà Lạt 3N2Đ  ',
        caption: 'Săn mây Cầu Đất',
        mediaUrls: ['/api/v1/uploads/community/pic.webp'],
        tags: ['DaLat', '#SanMay', 'DaLat'],
        itineraryId: 'itin-a',
      });

      expect(mockRepo.createPost).toHaveBeenCalledWith({
        userId: 'user-a',
        title: 'Đà Lạt 3N2Đ',
        caption: 'Săn mây Cầu Đất',
        mediaUrls: ['/api/v1/uploads/community/pic.webp'],
        tags: ['#DaLat', '#SanMay'],
        itineraryId: 'itin-a',
      });
      expect(result.id).toBe('post-1');
    });
  });

  describe('updatePost', () => {
    it('should forbid non-owner from updating a post', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'owner-id',
      });

      await expect(
        service.updatePost('stranger-id', UserRole.USER, 'post-1', {
          title: 'Tiêu đề mới',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to update title, caption and tags', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'owner-id',
      });
      mockRepo.updatePost.mockResolvedValue({
        id: 'post-1',
        title: 'Tiêu đề đã sửa',
        caption: 'Nội dung mới',
        tags: ['#DuLich'],
      });

      const res = await service.updatePost('owner-id', UserRole.USER, 'post-1', {
        title: '  Tiêu đề đã sửa  ',
        caption: '  Nội dung mới  ',
        tags: ['DuLich'],
      });

      expect(mockRepo.updatePost).toHaveBeenCalledWith(
        'post-1',
        {
          title: 'Tiêu đề đã sửa',
          caption: 'Nội dung mới',
          tags: ['#DuLich'],
        },
        'owner-id',
      );
      expect(res.title).toBe('Tiêu đề đã sửa');
    });

    it('should allow ADMIN to update any post', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'owner-id',
      });
      mockRepo.updatePost.mockResolvedValue({
        id: 'post-1',
        title: 'Admin điều chỉnh tiêu đề',
        tags: [],
      });

      const res = await service.updatePost('admin-id', UserRole.ADMIN, 'post-1', {
        title: 'Admin điều chỉnh tiêu đề',
      });

      expect(mockRepo.updatePost).toHaveBeenCalledWith(
        'post-1',
        {
          title: 'Admin điều chỉnh tiêu đề',
          caption: null,
          tags: [],
        },
        'admin-id',
      );
      expect(res.title).toBe('Admin điều chỉnh tiêu đề');
    });
  });

  describe('deletePost', () => {
    it('should forbid non-owner and non-admin from deleting a post', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'owner-id',
      });

      await expect(
        service.deletePost('stranger-id', UserRole.USER, 'post-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to soft-delete their post', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'owner-id',
      });

      const res = await service.deletePost('owner-id', UserRole.USER, 'post-1');
      expect(mockRepo.softDeletePost).toHaveBeenCalledWith('post-1');
      expect(res).toEqual({ success: true, id: 'post-1' });
    });
  });

  describe('toggleLike', () => {
    it('should throw NotFoundException if post does not exist', async () => {
      mockRepo.findPostById.mockResolvedValue(null);
      await expect(service.toggleLike('user-1', 'missing-post')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should toggle like atomically via repository', async () => {
      mockRepo.findPostById.mockResolvedValue({ id: 'post-1', userId: 'user-2' });
      mockRepo.togglePostLike.mockResolvedValue({ isLiked: true, likeCount: 15 });

      const res = await service.toggleLike('user-1', 'post-1');
      expect(res).toEqual({
        postId: 'post-1',
        isLiked: true,
        likeCount: 15,
      });
    });
  });

  describe('createComment (1-Level Reply Flattening)', () => {
    it('should flatten parentId to root comment when replying to a level-2 reply', async () => {
      mockRepo.findPostById.mockResolvedValue({ id: 'post-1', userId: 'u-1' });
      mockRepo.findCommentById.mockResolvedValue({
        id: 'reply-1',
        postId: 'post-1',
        userId: 'u-2',
        parentId: 'root-cmt-1',
        authorFullName: 'Minh Quân',
        postOwnerId: 'u-1',
      });
      mockRepo.createComment.mockResolvedValue({
        comment: {
          id: 'reply-2',
          postId: 'post-1',
          userId: 'u-3',
          parentId: 'root-cmt-1',
          replyToName: 'Minh Quân',
          content: 'Mình cũng muốn hỏi giống bạn!',
        },
        commentCount: 3,
      });

      const res = await service.createComment('u-3', 'post-1', {
        content: 'Mình cũng muốn hỏi giống bạn!',
        parentId: 'reply-1',
      });

      expect(mockRepo.createComment).toHaveBeenCalledWith(
        'post-1',
        'u-3',
        'Mình cũng muốn hỏi giống bạn!',
        'root-cmt-1',
        'Minh Quân',
      );
      expect(res.comment.parentId).toBe('root-cmt-1');
    });
  });

  describe('deleteComment', () => {
    it('should allow post owner to delete a spam comment on their post', async () => {
      mockRepo.findCommentById.mockResolvedValue({
        id: 'cmt-1',
        postId: 'post-1',
        userId: 'spammer-id',
        postOwnerId: 'post-owner-id',
      });
      mockRepo.softDeleteComment.mockResolvedValue({ commentCount: 4 });

      const res = await service.deleteComment(
        'post-owner-id',
        UserRole.USER,
        'cmt-1',
      );
      expect(mockRepo.softDeleteComment).toHaveBeenCalledWith('cmt-1', 'post-1');
      expect(res.commentCount).toBe(4);
    });

    it('should forbid unrelated user from deleting someone else comment', async () => {
      mockRepo.findCommentById.mockResolvedValue({
        id: 'cmt-1',
        postId: 'post-1',
        userId: 'comment-author',
        postOwnerId: 'post-owner-id',
      });

      await expect(
        service.deleteComment('stranger-id', UserRole.USER, 'cmt-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCreatorProfile', () => {
    it('should return aggregated creator profile stats and public trips', async () => {
      const mockProfile = {
        user: {
          id: 'u-1',
          username: 'khanhlinh',
          fullName: 'Khánh Linh',
          avatarUrl: null,
          bio: 'Travel Blogger',
          isVerified: true,
          createdAt: new Date(),
        },
        stats: {
          postCount: 3,
          totalLikesReceived: 120,
          totalClonesReceived: 18,
          publicItineraryCount: 2,
        },
        posts: [],
        publicItineraries: [],
      };
      mockRepo.getCreatorProfile.mockResolvedValue(mockProfile);

      const res = await service.getCreatorProfile('@khanhlinh', 'viewer-1');
      expect(mockRepo.getCreatorProfile).toHaveBeenCalledWith(
        '@khanhlinh',
        'viewer-1',
      );
      expect(res.stats.totalClonesReceived).toBe(18);
    });

    it('should throw NotFoundException when creator does not exist', async () => {
      mockRepo.getCreatorProfile.mockResolvedValue(null);
      await expect(service.getCreatorProfile('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getFeed', () => {
    it('should pass normalized sort mode and pagination limit to repository', async () => {
      mockRepo.findFeedPosts.mockResolvedValue({ items: [], nextCursor: null });

      await service.getFeed(
        { sort: CommunitySortMode.TRENDING, limit: 10 },
        'viewer-1',
      );

      expect(mockRepo.findFeedPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: CommunitySortMode.TRENDING,
          limit: 10,
          viewerId: 'viewer-1',
        }),
      );
    });
  });
});
