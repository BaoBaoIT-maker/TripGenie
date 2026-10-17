import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { AuthenticatedUser } from '@/common/types';
import { UserRole } from '@prisma/client';

describe('CollectionsController', () => {
  let controller: CollectionsController;
  let mockService: {
    getUserCollections: jest.Mock;
    getSavedPlaceIds: jest.Mock;
    createCollection: jest.Mock;
    togglePlace: jest.Mock;
    getCollectionDetail: jest.Mock;
    updateCollection: jest.Mock;
    deleteCollection: jest.Mock;
    addPlace: jest.Mock;
    removePlace: jest.Mock;
    getCollectionsContainingPlace: jest.Mock;
  };

  const mockUser = {
    id: 'user-123',
    email: 'traveler@tripgenie.vn',
    fullName: 'Traveler',
    role: UserRole.USER,
    isVerified: true,
    authVersion: 1,
  } as any;

  beforeEach(async () => {
    mockService = {
      getUserCollections: jest.fn(),
      getSavedPlaceIds: jest.fn(),
      createCollection: jest.fn(),
      togglePlace: jest.fn(),
      getCollectionDetail: jest.fn(),
      updateCollection: jest.fn(),
      deleteCollection: jest.fn(),
      addPlace: jest.fn(),
      removePlace: jest.fn(),
      getCollectionsContainingPlace: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        {
          provide: CollectionsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CollectionsController>(CollectionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get user collections', async () => {
    mockService.getUserCollections.mockResolvedValue([{ id: 'c-1', title: 'Yêu thích' }]);
    const res = await controller.getMyCollections(mockUser);
    expect(res.collections).toHaveLength(1);
    expect(mockService.getUserCollections).toHaveBeenCalledWith('user-123');
  });

  it('should get saved place ids', async () => {
    mockService.getSavedPlaceIds.mockResolvedValue(['p-1', 'p-2']);
    const res = await controller.getSavedPlaceIds(mockUser);
    expect(res.savedPlaceIds).toEqual(['p-1', 'p-2']);
    expect(mockService.getSavedPlaceIds).toHaveBeenCalledWith('user-123');
  });

  it('should toggle place bookmark', async () => {
    mockService.togglePlace.mockResolvedValue({
      isSaved: true,
      collectionId: 'c-1',
      placeId: 'p-1',
    });
    const res = await controller.togglePlace(mockUser, { placeId: 'p-1' });
    expect(res.isSaved).toBe(true);
    expect(mockService.togglePlace).toHaveBeenCalledWith('user-123', { placeId: 'p-1' });
  });

  it('should get collection detail', async () => {
    mockService.getCollectionDetail.mockResolvedValue({ id: 'c-1', title: 'Yêu thích' });
    const res = await controller.getCollectionDetail('c-1', 'user-123');
    expect(res.collection.title).toBe('Yêu thích');
    expect(mockService.getCollectionDetail).toHaveBeenCalledWith('user-123', 'c-1');
  });

  it('should get collections containing place', async () => {
    mockService.getCollectionsContainingPlace.mockResolvedValue(['c-1', 'c-2']);
    const res = await controller.getCollectionsContainingPlace(mockUser, 'p-1');
    expect(res.collectionIds).toEqual(['c-1', 'c-2']);
    expect(mockService.getCollectionsContainingPlace).toHaveBeenCalledWith('user-123', 'p-1');
  });
});

