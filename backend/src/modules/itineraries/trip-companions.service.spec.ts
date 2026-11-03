import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TripCompanionsService } from './trip-companions.service';
import { TripCompanionsRepository } from './trip-companions.repository';

describe('TripCompanionsService', () => {
  let service: TripCompanionsService;
  let mockRepo: {
    findUserByEmail: jest.Mock;
    createInvitation: jest.Mock;
    listCompanions: jest.Mock;
    findInvitationById: jest.Mock;
    acceptInvitation: jest.Mock;
    declineInvitation: jest.Mock;
    revokeInvitation: jest.Mock;
    updateMemberRole: jest.Mock;
    removeMember: jest.Mock;
    leaveTrip: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findUserByEmail: jest.fn(),
      createInvitation: jest.fn(),
      listCompanions: jest.fn(),
      findInvitationById: jest.fn(),
      acceptInvitation: jest.fn(),
      declineInvitation: jest.fn(),
      revokeInvitation: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      leaveTrip: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripCompanionsService,
        { provide: TripCompanionsRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TripCompanionsService>(TripCompanionsService);
  });

  describe('inviteCompanion', () => {
    it('throws NotFoundException if user email does not exist', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.inviteCompanion('itin-1', 'owner-1', 'nonexistent@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates invitation when user email exists', async () => {
      mockRepo.findUserByEmail.mockResolvedValue({
        id: 'invitee-1',
        email: 'friend@example.com',
      });
      mockRepo.createInvitation.mockResolvedValue({
        invitationId: 'inv-1',
        status: 'PENDING',
        expiresAt: '2026-11-10T00:00:00.000Z',
      });

      const res = await service.inviteCompanion('itin-1', 'owner-1', 'friend@example.com');
      expect(mockRepo.createInvitation).toHaveBeenCalledWith('itin-1', 'owner-1', 'invitee-1');
      expect(res.invitationId).toBe('inv-1');
    });
  });

  describe('acceptInvitation', () => {
    it('delegates to repository', async () => {
      mockRepo.acceptInvitation.mockResolvedValue({
        itineraryId: 'itin-1',
        role: 'VIEWER',
      });

      const res = await service.acceptInvitation('inv-1', 'invitee-1');
      expect(mockRepo.acceptInvitation).toHaveBeenCalledWith('inv-1', 'invitee-1');
      expect(res.role).toBe('VIEWER');
    });
  });

  describe('declineInvitation', () => {
    it('delegates to repository', async () => {
      mockRepo.declineInvitation.mockResolvedValue({ success: true, status: 'DECLINED' });

      const res = await service.declineInvitation('inv-1', 'invitee-1');
      expect(mockRepo.declineInvitation).toHaveBeenCalledWith('inv-1', 'invitee-1');
      expect(res.success).toBe(true);
    });
  });

  describe('revokeInvitation', () => {
    it('delegates to repository', async () => {
      mockRepo.revokeInvitation.mockResolvedValue({ success: true, status: 'REVOKED' });

      const res = await service.revokeInvitation('inv-1', 'owner-1');
      expect(mockRepo.revokeInvitation).toHaveBeenCalledWith('inv-1', 'owner-1');
      expect(res.success).toBe(true);
    });
  });

  describe('member management', () => {
    it('updateMemberRole delegates to repository', async () => {
      mockRepo.updateMemberRole.mockResolvedValue({ userId: 'user-2', role: 'EDITOR' });

      const res = await service.updateMemberRole('itin-1', 'owner-1', 'user-2', 'EDITOR');
      expect(mockRepo.updateMemberRole).toHaveBeenCalledWith(
        'itin-1',
        'owner-1',
        'user-2',
        'EDITOR',
      );
      expect(res.role).toBe('EDITOR');
    });

    it('removeMember delegates to repository', async () => {
      mockRepo.removeMember.mockResolvedValue({ success: true, removedUserId: 'user-2' });

      const res = await service.removeMember('itin-1', 'owner-1', 'user-2');
      expect(mockRepo.removeMember).toHaveBeenCalledWith('itin-1', 'owner-1', 'user-2');
      expect(res.success).toBe(true);
    });

    it('leaveTrip delegates to repository', async () => {
      mockRepo.leaveTrip.mockResolvedValue({ success: true, leftUserId: 'user-2' });

      const res = await service.leaveTrip('itin-1', 'user-2');
      expect(mockRepo.leaveTrip).toHaveBeenCalledWith('itin-1', 'user-2');
      expect(res.success).toBe(true);
    });
  });
});
