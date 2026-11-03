import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsService } from './collections.service';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let mockRepo: {
    findUserCollections: jest.Mock;
    findCollectionById: jest.Mock;
    createCollection: jest.Mock;
    updateCollection: jest.Mock;
    softDeleteCollection: jest.Mock;
    findSavedPlaceIds: jest.Mock;
    addPlaceToCollection: jest.Mock;
    removePlaceFromCollection: jest.Mock;
    isPlaceInCollection: jest.Mock;
    findOrCreateDefaultCollection: jest.Mock;
    findCollectionsContainingPlace: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findUserCollections: jest.fn(),
      findCollectionById: jest.fn(),
      createCollection: jest.fn(),
      updateCollection: jest.fn(),
      softDeleteCollection: jest.fn(),
      findSavedPlaceIds: jest.fn(),
      addPlaceToCollection: jest.fn(),
      removePlaceFromCollection: jest.fn(),
      isPlaceInCollection: jest.fn(),
      findOrCreateDefaultCollection: jest.fn(),
      findCollectionsContainingPlace: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        {
          provide: INJECT_TOKENS.COLLECTION_REPOSITORY,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserCollections', () => {
    it('should ensure default collection and return user collections', async () => {
      mockRepo.findOrCreateDefaultCollection.mockResolvedValue({ id: 'c-1', title: 'Yêu thích' });
      mockRepo.findUserCollections.mockResolvedValue([
        { id: 'c-1', title: 'Yêu thích', _count: { places: 2 } },
      ]);

      const result = await service.getUserCollections('u-1');
      expect(mockRepo.findOrCreateDefaultCollection).toHaveBeenCalledWith('u-1');
      expect(mockRepo.findUserCollections).toHaveBeenCalledWith('u-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getSavedPlaceIds', () => {
    it('should return saved place IDs from repository', async () => {
      mockRepo.findSavedPlaceIds.mockResolvedValue(['p-1', 'p-2']);
      const result = await service.getSavedPlaceIds('u-1');
      expect(result).toEqual(['p-1', 'p-2']);
      expect(mockRepo.findSavedPlaceIds).toHaveBeenCalledWith('u-1');
    });
  });

  describe('getCollectionDetail', () => {
    it('should throw NotFoundException if collection not found', async () => {
      mockRepo.findCollectionById.mockResolvedValue(null);
      await expect(service.getCollectionDetail('u-1', 'c-999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if collection is private and caller is not owner', async () => {
      mockRepo.findCollectionById.mockResolvedValue({
        id: 'c-1',
        userId: 'owner-id',
        isPublic: false,
      });
      await expect(service.getCollectionDetail('stranger-id', 'c-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow access if collection is public even if caller is not owner', async () => {
      const col = { id: 'c-1', userId: 'owner-id', isPublic: true };
      mockRepo.findCollectionById.mockResolvedValue(col);
      const result = await service.getCollectionDetail('stranger-id', 'c-1');
      expect(result).toEqual(col);
    });
  });

  describe('deleteCollection', () => {
    it('should forbid deleting the default "Yêu thích" collection', async () => {
      mockRepo.findCollectionById.mockResolvedValue({
        id: 'c-1',
        userId: 'u-1',
        title: 'Yêu thích',
      });
      await expect(service.deleteCollection('u-1', 'c-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should soft delete user collection', async () => {
      mockRepo.findCollectionById.mockResolvedValue({
        id: 'c-2',
        userId: 'u-1',
        title: 'Quán cafe đẹp',
      });
      const result = await service.deleteCollection('u-1', 'c-2');
      expect(mockRepo.softDeleteCollection).toHaveBeenCalledWith('c-2');
      expect(result.success).toBe(true);
    });
  });

  describe('createCollection & updateCollection reserved title guard', () => {
    it('should forbid creating a custom collection named "Yêu thích"', async () => {
      await expect(
        service.createCollection('u-1', { title: '  yêu thích ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should forbid renaming a custom collection to "Yêu thích"', async () => {
      mockRepo.findCollectionById.mockResolvedValue({
        id: 'c-2',
        userId: 'u-1',
        title: 'Quán cafe đẹp',
      });
      await expect(
        service.updateCollection('u-1', 'c-2', { title: 'Yêu thích' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('togglePlace', () => {
    it('should add place to default collection when not currently saved in any collection', async () => {
      mockRepo.findCollectionsContainingPlace.mockResolvedValue([]);
      mockRepo.findOrCreateDefaultCollection.mockResolvedValue({ id: 'c-default' });

      const result = await service.togglePlace('u-1', { placeId: 'p-1' });

      expect(mockRepo.findCollectionsContainingPlace).toHaveBeenCalledWith('u-1', 'p-1');
      expect(mockRepo.findOrCreateDefaultCollection).toHaveBeenCalledWith('u-1');
      expect(mockRepo.addPlaceToCollection).toHaveBeenCalledWith('c-default', 'p-1');
      expect(result).toEqual({
        isSaved: true,
        collectionId: 'c-default',
        placeId: 'p-1',
      });
    });

    it('should remove place from all containing collections when global toggle is called and place is saved', async () => {
      mockRepo.findCollectionsContainingPlace.mockResolvedValue(['c-1', 'c-2']);

      const result = await service.togglePlace('u-1', { placeId: 'p-1' });

      expect(mockRepo.findCollectionsContainingPlace).toHaveBeenCalledWith('u-1', 'p-1');
      expect(mockRepo.removePlaceFromCollection).toHaveBeenCalledWith('c-1', 'p-1');
      expect(mockRepo.removePlaceFromCollection).toHaveBeenCalledWith('c-2', 'p-1');
      expect(result).toEqual({
        isSaved: false,
        collectionId: 'c-1',
        placeId: 'p-1',
      });
    });

    it('should toggle place in specific collection when collectionId is provided', async () => {
      mockRepo.findCollectionById.mockResolvedValue({ id: 'c-custom', userId: 'u-1' });
      mockRepo.isPlaceInCollection.mockResolvedValue(true);

      const result = await service.togglePlace('u-1', { placeId: 'p-1', collectionId: 'c-custom' });

      expect(mockRepo.findCollectionById).toHaveBeenCalledWith('c-custom');
      expect(mockRepo.removePlaceFromCollection).toHaveBeenCalledWith('c-custom', 'p-1');
      expect(result).toEqual({
        isSaved: false,
        collectionId: 'c-custom',
        placeId: 'p-1',
      });
    });

    it('should throw ForbiddenException if user does not own target collection', async () => {
      mockRepo.findCollectionById.mockResolvedValue({ id: 'c-other', userId: 'other-user' });

      await expect(
        service.togglePlace('u-1', { placeId: 'p-1', collectionId: 'c-other' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCollectionsContainingPlace', () => {
    it('should return collection IDs containing the given place', async () => {
      mockRepo.findCollectionsContainingPlace.mockResolvedValue(['c-1', 'c-2']);
      const result = await service.getCollectionsContainingPlace('u-1', 'p-1');
      expect(result).toEqual(['c-1', 'c-2']);
      expect(mockRepo.findCollectionsContainingPlace).toHaveBeenCalledWith('u-1', 'p-1');
    });
  });
});

