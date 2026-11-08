import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReportStatus, ReportType, UserRole } from '@prisma/client';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { CommunityService } from './community.service';
import { CommunitySortMode } from './community.constants';

describe('CommunityService', () => {
  let service: CommunityService;
  let mockRepo: {
    findActiveGroups: jest.Mock;
    findGroupByIdOrSlug: jest.Mock;
    findDefaultGroup: jest.Mock;
    createCommunityGroup: jest.Mock;
    getSidebarDiscovery: jest.Mock;
    findFeedPosts: jest.Mock;
    findPostById: jest.Mock;
    findItineraryOwner: jest.Mock;
    createPost: jest.Mock;
    updatePost: jest.Mock;
    softDeletePost: jest.Mock;
    togglePostLike: jest.Mock;
    reportPost: jest.Mock;
    findPostComments: jest.Mock;
    findCommentById: jest.Mock;
    getCommentContext: jest.Mock;
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
      findActiveGroups: jest.fn(),
      findGroupByIdOrSlug: jest.fn(),
      findDefaultGroup: jest.fn().mockResolvedValue({
        id: 'default-group-id',
        name: 'Cộng đồng chung TripGenie',
        slug: 'cong-dong-chung',
        isDefault: true,
      }),
      createCommunityGroup: jest.fn(),
      getSidebarDiscovery: jest.fn(),
      findFeedPosts: jest.fn(),
      findPostById: jest.fn(),
      findItineraryOwner: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn(),
      softDeletePost: jest.fn(),
      togglePostLike: jest.fn(),
      reportPost: jest.fn(),
      findPostComments: jest.fn(),
      findCommentById: jest.fn(),
      getCommentContext: jest.fn(),
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

  describe('createPost', () => {
    it('should throw BadRequestException if title is empty', async () => {
      await expect(
        service.createPost('user-1', {
          title: '   ',
          tags: ['saigon'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsafe media URLs', async () => {
      await expect(
        service.createPost('user-1', {
          title: 'Check-in Landmark 81',
          mediaUrls: ['javascript:alert(1)'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify itinerary ownership when attaching a trip', async () => {
      mockRepo.findItineraryOwner.mockResolvedValue({
        id: 'itin-1',
        creatorId: 'someone-else',
      });

      await expect(
        service.createPost('user-1', {
          title: 'Chuyến đi Đà Lạt',
          itineraryId: 'itin-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should normalize tags with hash prefix and assign default group when groupId omitted', async () => {
      mockRepo.createPost.mockResolvedValue({
        id: 'post-1',
        groupId: 'default-group-id',
        title: 'Check-in',
        tags: ['#dalat', '#travel'],
      });

      await service.createPost('user-1', {
        title: 'Check-in',
        tags: ['dalat', '#travel', 'dalat'],
      });

      expect(mockRepo.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 'default-group-id',
          tags: ['#dalat', '#travel'],
        }),
      );
    });

    it('should resolve explicit groupId/slug when creating a post in a topic group', async () => {
      mockRepo.findGroupByIdOrSlug.mockResolvedValue({
        id: 'group-san-may',
        slug: 'san-may-nui-rung',
        name: 'Săn Mây & Núi Rừng',
        isDefault: false,
      });
      mockRepo.createPost.mockResolvedValue({
        id: 'post-2',
        groupId: 'group-san-may',
        title: 'Săn mây Cầu Đất',
        tags: [],
      });

      await service.createPost('user-1', {
        title: 'Săn mây Cầu Đất',
        groupId: 'san-may-nui-rung',
      });

      expect(mockRepo.findGroupByIdOrSlug).toHaveBeenCalledWith('san-may-nui-rung');
      expect(mockRepo.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 'group-san-may',
        }),
      );
    });
  });

  describe('createGroup', () => {
    it('should forbid non-admin users from creating community groups', async () => {
      await expect(
        service.createGroup('user-1', UserRole.USER, {
          name: 'Nhóm Tự Phát',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to create a group with auto-generated slug', async () => {
      mockRepo.findGroupByIdOrSlug.mockResolvedValue(null);
      mockRepo.createCommunityGroup.mockResolvedValue({
        id: 'g-new',
        name: 'Phượt Tây Bắc Mùa Lúa Chín',
        slug: 'phuot-tay-bac-mua-lua-chin',
        isDefault: false,
        sortOrder: 5,
        postCount: 0,
      });

      const res = await service.createGroup('admin-1', UserRole.ADMIN, {
        name: 'Phượt Tây Bắc Mùa Lúa Chín',
        subtitle: 'Mù Cang Chải, Hoàng Su Phì',
        sortOrder: 5,
      });

      expect(mockRepo.createCommunityGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Phượt Tây Bắc Mùa Lúa Chín',
          slug: 'phuot-tay-bac-mua-lua-chin',
          createdBy: 'admin-1',
        }),
      );
      expect(res.slug).toBe('phuot-tay-bac-mua-lua-chin');
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockRepo.findGroupByIdOrSlug.mockResolvedValue({
        id: 'g-1',
        slug: 'san-may-nui-rung',
      });

      await expect(
        service.createGroup('admin-1', UserRole.ADMIN, {
          name: 'Săn Mây & Núi Rừng',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reportPost', () => {
    it('should throw NotFoundException if post does not exist', async () => {
      mockRepo.findPostById.mockResolvedValue(null);

      await expect(
        service.reportPost('user-1', 'missing-post', {
          reportType: ReportType.SPAM,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should forbid users from reporting their own post', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'user-1',
      });

      await expect(
        service.reportPost('user-1', 'post-1', {
          reportType: ReportType.SPAM,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create content report for another user post', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'author-2',
      });
      mockRepo.reportPost.mockResolvedValue({
        id: 'rep-1',
        postId: 'post-1',
        reportType: ReportType.FALSE_INFO,
        status: ReportStatus.PENDING,
        alreadyReported: false,
      });

      const res = await service.reportPost('user-1', 'post-1', {
        reportType: ReportType.FALSE_INFO,
        description: '  Giá vé sai thực tế  ',
      });

      expect(mockRepo.reportPost).toHaveBeenCalledWith({
        postId: 'post-1',
        reportedBy: 'user-1',
        reportType: ReportType.FALSE_INFO,
        description: 'Giá vé sai thực tế',
      });
      expect(res.alreadyReported).toBe(false);
    });
  });

  describe('getSidebarDiscovery', () => {
    it('should cache anonymous sidebar discovery and invalidate on post creation', async () => {
      const sampleSidebar = {
        groups: [],
        topClonedPosts: [],
        checkinHighlights: [],
        topCreators: [],
      };
      mockRepo.getSidebarDiscovery.mockResolvedValue(sampleSidebar);

      await service.getSidebarDiscovery();
      await service.getSidebarDiscovery();

      expect(mockRepo.getSidebarDiscovery).toHaveBeenCalledTimes(1);

      service.invalidateSidebarCache();
      await service.getSidebarDiscovery();
      expect(mockRepo.getSidebarDiscovery).toHaveBeenCalledTimes(2);
    });
  });

  describe('updatePost', () => {
    it('should throw NotFoundException if post does not exist', async () => {
      mockRepo.findPostById.mockResolvedValue(null);

      await expect(
        service.updatePost('user-1', UserRole.USER, 'missing-id', {
          title: 'Tiêu đề mới',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should forbid non-owner non-admin users from updating post', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'owner-id',
      });

      await expect(
        service.updatePost('stranger-id', UserRole.USER, 'post-1', {
          title: 'Tiêu đề phá hoại',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to update post and normalize tags', async () => {
      mockRepo.findPostById.mockResolvedValue({
        id: 'post-1',
        userId: 'owner-id',
      });
      mockRepo.updatePost.mockResolvedValue({
        id: 'post-1',
        title: 'Tiêu đề đã sửa',
        tags: ['#DuLich'],
      });

      const res = await service.updatePost('owner-id', UserRole.USER, 'post-1', {
        title: 'Tiêu đề đã sửa',
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

  describe('createComment', () => {
    it('should throw BadRequestException if content is empty', async () => {
      await expect(
        service.createComment('u-1', 'post-1', { content: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delegate comment creation to repository', async () => {
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

      expect(mockRepo.createComment).toHaveBeenCalledWith({
        postId: 'post-1',
        userId: 'u-3',
        content: 'Mình cũng muốn hỏi giống bạn!',
        replyTargetCommentId: 'reply-1',
        replyToName: null,
      });
      expect(res.comment.id).toBe('reply-2');
    });
  });

  describe('getCommentContext', () => {
    it('should throw NotFoundException if post does not exist', async () => {
      mockRepo.findPostById.mockResolvedValue(null);

      await expect(
        service.getCommentContext('post-1', 'cmt-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if comment context does not exist', async () => {
      mockRepo.findPostById.mockResolvedValue({ id: 'post-1' });
      mockRepo.getCommentContext.mockResolvedValue(null);

      await expect(
        service.getCommentContext('post-1', 'cmt-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return context when comment and parent exist', async () => {
      mockRepo.findPostById.mockResolvedValue({ id: 'post-1' });
      mockRepo.getCommentContext.mockResolvedValue({
        comment: { id: 'cmt-2', parentId: 'cmt-1' },
        parent: { id: 'cmt-1', parentId: null },
      });

      const res = await service.getCommentContext('post-1', 'cmt-2');
      expect(res.comment.id).toBe('cmt-2');
      expect(res.parent?.id).toBe('cmt-1');
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
    it('should pass normalized sort mode, groupId, and pagination limit to repository', async () => {
      mockRepo.findFeedPosts.mockResolvedValue({ items: [], nextCursor: null });

      await service.getFeed(
        { sort: CommunitySortMode.TRENDING, limit: 10, groupId: 'san-may-nui-rung' },
        'viewer-1',
      );

      expect(mockRepo.findFeedPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: CommunitySortMode.TRENDING,
          groupId: 'san-may-nui-rung',
          limit: 10,
          viewerId: 'viewer-1',
        }),
      );
    });
  });
});
