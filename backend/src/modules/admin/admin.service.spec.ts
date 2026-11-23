import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction, PlaceStatus, UserRole } from '@prisma/client';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminPlacesService } from './services/admin-places.service';
import { AdminCommunityService } from './services/admin-community.service';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import { ADMIN_ERROR_CODES, ADMIN_CONSTANTS } from './admin.constants';

describe('AdminService', () => {
  let service: AdminService;
  let usersService: AdminUsersService;
  let placesService: AdminPlacesService;
  let communityService: AdminCommunityService;
  let mockPrisma: {
    auditLog: {
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    place: {
      findUnique: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    communityGroup: {
      findUnique: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    category: {
      findMany: jest.Mock;
    };
    communityPost: {
      count: jest.Mock;
    };
    postComment: {
      count: jest.Mock;
    };
    contentReport: {
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    placeImage: {
      findUnique: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

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

  const mockMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  };

  beforeEach(async () => {
    mockPrisma = {
      auditLog: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      place: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      communityGroup: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
      },
      communityPost: {
        count: jest.fn(),
      },
      postComment: {
        count: jest.fn(),
      },
      contentReport: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      placeImage: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        AdminUsersService,
        AdminPlacesService,
        AdminCommunityService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    usersService = module.get<AdminUsersService>(AdminUsersService);
    placesService = module.get<AdminPlacesService>(AdminPlacesService);
    communityService = module.get<AdminCommunityService>(AdminCommunityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Step 1: Foundation & Audit Log', () => {
    it('should create an audit log record with serialized JSON and request meta', async () => {
      const mockResult = {
        id: 'audit-123',
        actorId: 'admin-uuid-1',
        actorRole: UserRole.ADMIN,
        action: AuditAction.BAN,
        targetType: 'USER',
        targetId: 'user-uuid-2',
        targetLabel: 'test@example.com',
        beforeData: { isActive: true },
        afterData: { isActive: false },
        ipAddress: mockMeta.ipAddress,
        userAgent: mockMeta.userAgent,
        notes: 'Spamming content',
        createdAt: new Date(),
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockResult);

      const result = await service.logAudit({
        actorId: 'admin-uuid-1',
        actorRole: UserRole.ADMIN,
        action: AuditAction.BAN,
        targetType: 'USER',
        targetId: 'user-uuid-2',
        targetLabel: 'test@example.com',
        beforeData: { isActive: true },
        afterData: { isActive: false },
        ipAddress: mockMeta.ipAddress,
        userAgent: mockMeta.userAgent,
        notes: 'Spamming content',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should return paginated audit logs with metadata', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.BAN,
          targetType: 'USER',
          createdAt: new Date('2026-11-16T10:00:00Z'),
          actor: { id: 'admin-1', fullName: 'Super Admin', email: 'admin@tripgenie.vn' },
        },
      ];

      mockPrisma.$transaction.mockResolvedValue([1, mockLogs]);

      const result = await service.getAuditLogs({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('Step 2: User Isolation, Ban, Unban & Promotion (TOCTOU-safe)', () => {
    it('getUsers should strictly enforce role: USER to isolate admin accounts', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      await usersService.getUsers({ page: 1, limit: 20, search: 'john' });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      const countCall = mockPrisma.user.count.mock.calls[0][0];
      expect(countCall.where.role).toBe(UserRole.USER);
      expect(countCall.where.deletedAt).toBeNull();
    });

    describe('banUser', () => {
      it('should throw NotFoundException if user does not exist', async () => {
        const mockTx = {
          user: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        await expect(
          usersService.banUser(mockAdminUser, 'user-999', { reason: 'Violating rules' }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if target user is an Admin', async () => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'admin-2',
              role: UserRole.ADMIN,
              isActive: true,
            }),
          },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        try {
          await usersService.banUser(mockAdminUser, 'admin-2', { reason: 'Test' });
          fail('Should have thrown BadRequestException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(BadRequestException);
          expect(err.getResponse().code).toBe(ADMIN_ERROR_CODES.CANNOT_MANAGE_ADMIN);
        }
      });

      it('should successfully ban regular user and record audit log with IP & User-Agent inside transaction', async () => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-2',
              email: 'spammer@example.com',
              fullName: 'Spammer User',
              role: UserRole.USER,
              isActive: true,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        const result = await usersService.banUser(
          mockAdminUser,
          'user-2',
          { reason: 'Spamming' },
          mockMeta,
        );

        expect(result.success).toBe(true);
        expect(result.message).toBe(ADMIN_CONSTANTS.MESSAGES.BAN_SUCCESS);
        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: 'user-2' },
          data: {
            isActive: false,
            authVersion: { increment: 1 },
          },
        });
      });
    });

    describe('promoteUserToAdmin', () => {
      it('should successfully promote user to ADMIN, increment authVersion, and record audit log', async () => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-candidate',
              email: 'future.admin@example.com',
              fullName: 'Future Admin',
              role: UserRole.USER,
              isActive: true,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        const result = await usersService.promoteUserToAdmin(
          mockAdminUser,
          'user-candidate',
          { notes: 'Promoted to moderator/admin' },
          mockMeta,
        );

        expect(result.success).toBe(true);
        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: 'user-candidate' },
          data: {
            role: UserRole.ADMIN,
            authVersion: { increment: 1 },
          },
        });
      });
    });
  });

  describe('Step 3: Places CRUD, WGS84 & Area Bbox Bounds, Safe Soft-Delete', () => {
    describe('createPlace', () => {
      it('should reject coordinates outside WGS84 or at Null Island (0, 0)', async () => {
        const mockTx = {};
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        try {
          await placesService.createPlace(mockAdminUser, {
            name: 'Invalid Place',
            address: '123 Fake St',
            latitude: 120,
            longitude: 108,
          });
          fail('Should have thrown BadRequestException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(BadRequestException);
          expect(err.getResponse().code).toBe(ADMIN_ERROR_CODES.INVALID_COORDINATES);
        }
      });

      it('should reject coordinates outside the selected TravelArea bbox', async () => {
        const mockTx = {
          category: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
          travelArea: {
            findUnique: jest.fn().mockResolvedValue({
              id: 10,
              name: 'Đà Lạt',
              bboxMinLat: 11.8,
              bboxMaxLat: 12.1,
              bboxMinLng: 108.3,
              bboxMaxLng: 108.6,
            }),
          },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        try {
          await placesService.createPlace(mockAdminUser, {
            name: 'Hồ Gươm nhầm vùng Đà Lạt',
            address: 'Hoàn Kiếm',
            latitude: 21.0285,
            longitude: 105.8542,
            areaId: 10,
            categoryId: 1,
          });
          fail('Should have thrown BadRequestException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(BadRequestException);
          expect(err.getResponse().code).toBe(ADMIN_ERROR_CODES.COORDINATES_OUTSIDE_AREA);
        }
      });

      it('should create place, normalize Vietnamese name, sync PostGIS location, and log audit', async () => {
        const createdMock = {
          id: 'place-uuid-1',
          name: 'Đỉnh Bà Nà Hills',
          nameNormalized: 'dinh ba na hills',
          latitude: 15.9977,
          longitude: 107.9881,
          status: PlaceStatus.ACTIVE,
        };

        const mockTx = {
          category: { findUnique: jest.fn().mockResolvedValue({ id: 2 }) },
          travelArea: {
            findUnique: jest.fn().mockResolvedValue({
              id: 5,
              name: 'Đà Nẵng',
              bboxMinLat: 15.8,
              bboxMaxLat: 16.3,
              bboxMinLng: 107.8,
              bboxMaxLng: 108.4,
            }),
          },
          place: { create: jest.fn().mockResolvedValue(createdMock) },
          placeImage: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
          $executeRaw: jest.fn().mockResolvedValue(1),
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        const result = await placesService.createPlace(
          mockAdminUser,
          {
            name: '  Đỉnh Bà Nà Hills  ',
            address: 'Hòa Ninh, Hòa Vang, Đà Nẵng',
            latitude: 15.9977,
            longitude: 107.9881,
            areaId: 5,
            categoryId: 2,
            imageUrls: ['https://res.cloudinary.com/demo/image/upload/bana.jpg'],
          },
          mockMeta,
        );

        expect(result.success).toBe(true);
        expect(mockTx.place.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Đỉnh Bà Nà Hills',
              nameNormalized: 'dinh ba na hills',
              imageCount: 1,
            }),
          }),
        );
        expect(mockTx.$executeRaw).toHaveBeenCalled();
        expect(mockTx.auditLog.create).toHaveBeenCalled();
      });
    });

    describe('deletePlace (Safe Soft-Delete)', () => {
      it('should soft-delete place (deletedAt + INACTIVE) and record referenceCounts in AuditLog', async () => {
        const existingPlace = {
          id: 'place-referenced-1',
          name: 'Chợ Đêm Phú Quốc',
          status: PlaceStatus.ACTIVE,
          deletedAt: null,
          _count: {
            destinations: 12,
            collectionPlaces: 35,
            reviews: 8,
            proposals: 3,
          },
        };

        const mockTx = {
          place: {
            findUnique: jest.fn().mockResolvedValue(existingPlace),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        const result = await placesService.deletePlace(
          mockAdminUser,
          'place-referenced-1',
          mockMeta,
        );

        expect(result.success).toBe(true);
        expect(mockTx.place.update).toHaveBeenCalledWith({
          where: { id: 'place-referenced-1' },
          data: {
            deletedAt: expect.any(Date),
            status: PlaceStatus.INACTIVE,
          },
        });
      });
    });
  });

  describe('Step 4: Community Groups (Topics) CRUD & Default Group Protection', () => {
    describe('createCommunityGroup', () => {
      it('should auto-generate Vietnamese slug, create group, and log audit', async () => {
        const createdGroupMock = {
          id: 'group-uuid-1',
          name: 'Săn Mây Đà Lạt',
          slug: 'san-may-da-lat',
          isDefault: false,
          isActive: true,
        };

        const mockTx = {
          communityGroup: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(createdGroupMock),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        const result = await communityService.createCommunityGroup(
          mockAdminUser,
          {
            name: '  Săn Mây Đà Lạt  ',
            subtitle: 'Kinh nghiệm cắm trại & săn mây',
          },
          mockMeta,
        );

        expect(result.success).toBe(true);
        expect(mockTx.communityGroup.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Săn Mây Đà Lạt',
              slug: 'san-may-da-lat',
              isDefault: false,
            }),
          }),
        );
        expect(mockTx.auditLog.create).toHaveBeenCalled();
      });

      it('should throw ConflictException if slug already exists', async () => {
        const mockTx = {
          communityGroup: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'existing-id',
              slug: 'san-may-da-lat',
            }),
          },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        try {
          await communityService.createCommunityGroup(mockAdminUser, {
            name: 'Săn Mây Đà Lạt',
          });
          fail('Should have thrown ConflictException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(ConflictException);
          expect(err.getResponse().code).toBe(ADMIN_ERROR_CODES.GROUP_SLUG_EXISTS);
        }
      });
    });

    describe('updateCommunityGroup & deleteCommunityGroup', () => {
      it('should block deactivating or deleting the system default group', async () => {
        const defaultGroupMock = {
          id: 'default-group-id',
          name: 'Cộng đồng chung',
          slug: 'cong-dong-chung',
          isDefault: true,
          isActive: true,
          deletedAt: null,
        };

        const mockTx = {
          communityGroup: {
            findUnique: jest.fn().mockResolvedValue(defaultGroupMock),
          },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        try {
          await communityService.updateCommunityGroup(mockAdminUser, 'default-group-id', {
            isActive: false,
          });
          fail('Should have thrown BadRequestException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(BadRequestException);
          expect(err.getResponse().code).toBe(
            ADMIN_ERROR_CODES.CANNOT_DELETE_DEFAULT_GROUP,
          );
        }

        try {
          await communityService.deleteCommunityGroup(mockAdminUser, 'default-group-id');
          fail('Should have thrown BadRequestException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(BadRequestException);
          expect(err.getResponse().code).toBe(
            ADMIN_ERROR_CODES.CANNOT_DELETE_DEFAULT_GROUP,
          );
        }
      });

      it('should safely soft-delete a non-default group, reassign posts to default group, and log audit', async () => {
        const regularGroupMock = {
          id: 'group-regular-1',
          name: 'Phượt Tây Bắc',
          slug: 'phuot-tay-bac',
          isDefault: false,
          isActive: true,
          deletedAt: null,
        };

        const defaultGroupMock = {
          id: 'default-group-id',
          name: 'Cộng đồng chung',
          isDefault: true,
          isActive: true,
          deletedAt: null,
        };

        const mockTx = {
          communityGroup: {
            findUnique: jest.fn().mockResolvedValue(regularGroupMock),
            findFirst: jest.fn().mockResolvedValue(defaultGroupMock),
            update: jest.fn().mockResolvedValue({}),
          },
          communityPost: {
            updateMany: jest.fn().mockResolvedValue({ count: 5 }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

        const result = await communityService.deleteCommunityGroup(
          mockAdminUser,
          'group-regular-1',
          mockMeta,
        );

        expect(result.success).toBe(true);
        expect(mockTx.communityPost.updateMany).toHaveBeenCalledWith({
          where: { groupId: 'group-regular-1' },
          data: { groupId: 'default-group-id' },
        });
        expect(mockTx.communityGroup.update).toHaveBeenCalledWith({
          where: { id: 'group-regular-1' },
          data: {
            deletedAt: expect.any(Date),
            isActive: false,
            postCount: 0,
          },
        });
        expect(mockTx.auditLog.create).toHaveBeenCalled();
      });
    });
  });

  describe('Step 6: Lean Dashboard Analytics (Single Round-Trip)', () => {
    it('should aggregate users, places, community, and moderation KPIs in one transaction', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        150, // totalUsers
        142, // activeUsers
        8, // bannedUsers
        19, // newUsersThisWeek
        1200, // totalPlaces
        1180, // activePlaces
        20, // inactivePlaces
        [
          {
            id: 1,
            name: 'Food & Drink',
            nameVi: 'Ẩm thực',
            slug: 'am-thuc',
            _count: { places: 450 },
          },
        ], // categoriesWithCount
        320, // approvedPosts
        5, // pendingPosts
        3, // flaggedPosts
        890, // totalComments
        6, // activeGroups
        28, // pendingReports
        [
          { targetType: 'POST', targetId: 'post-hot-1', _count: { _all: 22 } },
          { targetType: 'POST', targetId: 'post-norm-2', _count: { _all: 6 } },
        ], // pendingReportsByTarget
        9, // rejectedPosts
        4, // pendingPlacePhotos
      ]);

      const stats = await service.getDashboardStats();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(stats.users).toEqual({
        total: 150,
        active: 142,
        banned: 8,
        newThisWeek: 19,
      });
      expect(stats.places.total).toBe(1200);
      expect(stats.places.pendingPhotos).toBe(4);
      expect(stats.places.byCategory).toEqual([
        {
          id: 1,
          name: 'Food & Drink',
          nameVi: 'Ẩm thực',
          slug: 'am-thuc',
          placeCount: 450,
        },
      ]);
      expect(stats.community).toEqual({
        approvedPosts: 320,
        totalComments: 890,
        activeGroups: 6,
      });
      expect(stats.moderation).toEqual({
        pendingPosts: 5,
        flaggedPosts: 3,
        rejectedPosts: 9,
        pendingReports: 28,
        highPriorityReportAlerts: 1,
        highPriorityReportThreshold: 20,
      });
    });
  });

  describe('Step 7: Place Photo Contributions Moderation', () => {
    it('approves a pending photo and promotes it to primary atomically', async () => {
      mockPrisma.placeImage.findUnique.mockResolvedValue({
        id: 'img-1',
        placeId: 'place-1',
        status: 'PENDING',
        isPrimary: false,
        place: { id: 'place-1', name: 'Bãi Mỹ Khê' },
      });

      const txMock = {
        placeImage: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue({
            id: 'img-1',
            status: 'APPROVED',
            isPrimary: true,
          }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) =>
        cb(txMock),
      );

      const res = await placesService.approvePlacePhoto(
        mockAdminUser,
        'img-1',
        { setAsPrimary: true },
        mockMeta,
      );

      expect(res.success).toBe(true);
      expect(txMock.placeImage.updateMany).toHaveBeenCalledWith({
        where: { placeId: 'place-1', id: { not: 'img-1' } },
        data: { isPrimary: false },
      });
      expect(txMock.placeImage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'img-1' },
          data: expect.objectContaining({
            status: 'APPROVED',
            isPrimary: true,
          }),
        }),
      );
      expect(txMock.auditLog.create).toHaveBeenCalled();
    });

    it('rejects a photo while keeping its record and logs audit trail', async () => {
      mockPrisma.placeImage.findUnique.mockResolvedValue({
        id: 'img-2',
        placeId: 'place-1',
        status: 'PENDING',
        isPrimary: false,
        place: { id: 'place-1', name: 'Bãi Mỹ Khê' },
      });

      const txMock = {
        placeImage: {
          update: jest.fn().mockResolvedValue({
            id: 'img-2',
            status: 'REJECTED',
            isPrimary: false,
          }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-2' }) },
      };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) =>
        cb(txMock),
      );

      const res = await placesService.rejectPlacePhoto(
        mockAdminUser,
        'img-2',
        { reason: 'Ảnh bị mờ' },
        mockMeta,
      );

      expect(res.success).toBe(true);
      expect(txMock.placeImage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            isPrimary: false,
            moderationNote: 'Ảnh bị mờ',
          }),
        }),
      );
      expect(txMock.auditLog.create).toHaveBeenCalled();
    });
  });
});
