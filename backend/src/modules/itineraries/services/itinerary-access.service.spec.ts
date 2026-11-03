import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ItineraryAccessService } from './itinerary-access.service';
import { PrismaService } from '../../../database/prisma.service';

describe('ItineraryAccessService', () => {
  let service: ItineraryAccessService;
  let mockPrisma: {
    itinerary: {
      findFirst: jest.Mock;
    };
  };

  const mockItineraryBase = {
    id: 'itin-1',
    creatorId: 'owner-id',
    isPublic: false,
    deletedAt: null,
    updatedAt: new Date('2026-11-03T00:00:00Z'),
  };

  beforeEach(async () => {
    mockPrisma = {
      itinerary: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItineraryAccessService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ItineraryAccessService>(ItineraryAccessService);
  });

  describe('getAccess', () => {
    it('throws NotFoundException if itinerary does not exist', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue(null);
      await expect(service.getAccess('missing-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('identifies owner with full permissions', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        tripGroup: null,
      });

      const access = await service.getAccess('itin-1', 'owner-id');
      expect(access.role).toBe('OWNER');
      expect(access.isOwner).toBe(true);
      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canManageMembers).toBe(true);
    });

    it('identifies editor with edit rights but no member management', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        tripGroup: {
          id: 'group-1',
          members: [{ role: 'EDITOR' }],
        },
      });

      const access = await service.getAccess('itin-1', 'editor-id');
      expect(access.role).toBe('EDITOR');
      expect(access.isOwner).toBe(false);
      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canManageMembers).toBe(false);
    });

    it('identifies viewer with view-only rights', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        tripGroup: {
          id: 'group-1',
          members: [{ role: 'VIEWER' }],
        },
      });

      const access = await service.getAccess('itin-1', 'viewer-id');
      expect(access.role).toBe('VIEWER');
      expect(access.isOwner).toBe(false);
      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(false);
      expect(access.canManageMembers).toBe(false);
    });

    it('denies view for stranger on private itinerary', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        isPublic: false,
        tripGroup: {
          id: 'group-1',
          members: [],
        },
      });

      const access = await service.getAccess('itin-1', 'stranger-id');
      expect(access.role).toBeNull();
      expect(access.canView).toBe(false);
      expect(access.canEdit).toBe(false);
      expect(access.canManageMembers).toBe(false);
    });

    it('allows view for guest on public itinerary', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        isPublic: true,
        tripGroup: null,
      });

      const access = await service.getAccess('itin-1', undefined);
      expect(access.role).toBeNull();
      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(false);
    });
  });

  describe('assertCanView', () => {
    it('throws UnauthorizedException for guest on private itinerary', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        isPublic: false,
        tripGroup: null,
      });

      await expect(service.assertCanView('itin-1', undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException for logged in stranger on private itinerary', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        isPublic: false,
        tripGroup: { members: [] },
      });

      await expect(service.assertCanView('itin-1', 'stranger-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertCanEdit', () => {
    it('throws ForbiddenException for VIEWER', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        tripGroup: { members: [{ role: 'VIEWER' }] },
      });

      await expect(service.assertCanEdit('itin-1', 'viewer-id')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('passes for EDITOR and OWNER', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        tripGroup: { members: [{ role: 'EDITOR' }] },
      });

      const editorAccess = await service.assertCanEdit('itin-1', 'editor-id');
      expect(editorAccess.canEdit).toBe(true);
    });
  });

  describe('assertOwner', () => {
    it('throws ForbiddenException for EDITOR', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        tripGroup: { members: [{ role: 'EDITOR' }] },
      });

      await expect(service.assertOwner('itin-1', 'editor-id')).rejects.toThrow(ForbiddenException);
    });

    it('passes for creator/owner', async () => {
      mockPrisma.itinerary.findFirst.mockResolvedValue({
        ...mockItineraryBase,
        tripGroup: null,
      });

      const ownerAccess = await service.assertOwner('itin-1', 'owner-id');
      expect(ownerAccess.isOwner).toBe(true);
    });
  });
});
