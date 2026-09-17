import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlacesService } from './places.service';
import { IPlaceRepository } from './interfaces/place-repository.interface';
import { IEmbeddingService } from './interfaces/embedding-service.interface';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import { BudgetLevel } from '@prisma/client';
import { PlaceSortBy, SortOrder } from '../../common/enums/places.enum';

describe('PlacesService', () => {
  let service: PlacesService;
  let repository: jest.Mocked<IPlaceRepository>;
  let embeddingService: jest.Mocked<IEmbeddingService>;

  const mockRawPlaceRow = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Art Coffee',
    name_normalized: 'art coffee',
    description: 'Nice cafe with ocean view',
    address: '77 Thach Lam, Da Nang',
    district: 'Son Tra',
    city: 'Da Nang',
    latitude: 16.054,
    longitude: 108.202,
    price_level: BudgetLevel.MEDIUM,
    opening_hours: '07:00-22:00',
    phone: '+84 98 551 13 24',
    website: 'https://artcoffee.vn',
    rating_avg: 4.6,
    review_count: 25,
    image_count: 3,
    category_id: 1,
    category_name: 'Ca phe',
    category_name_vi: 'Cà phê',
    category_slug: 'ca-phe',
    category_icon_url: 'https://img.tripgenie.app/icons/cafe.svg',
    area_id: 1,
    area_name: 'Da Nang',
    area_name_vi: 'Đà Nẵng',
    area_slug: 'da-nang',
    primary_image: 'https://images.tripgenie.app/artcoffee-cover.jpg',
    distance_meters: 350,
    similarity_score: 0.895,
    full_count: 1,
  };

  beforeEach(async () => {
    const mockRepo: Partial<jest.Mocked<IPlaceRepository>> = {
      searchPlaces: jest.fn(),
      findNearby: jest.fn(),
      findById: jest.fn(),
      findCategories: jest.fn(),
      findTravelAreas: jest.fn(),
      searchSemantic: jest.fn(),
      upsertPlaceEmbedding: jest.fn(),
      findPlacesWithoutEmbedding: jest.fn(),
    };

    const mockEmbedding: jest.Mocked<IEmbeddingService> = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.01)),
      getModelName: jest.fn().mockReturnValue('models/gemini-embedding-2'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        {
          provide: INJECT_TOKENS.PLACE_REPOSITORY,
          useValue: mockRepo,
        },
        {
          provide: INJECT_TOKENS.EMBEDDING_SERVICE,
          useValue: mockEmbedding,
        },
      ],
    }).compile();

    service = module.get<PlacesService>(PlacesService);
    repository = module.get(INJECT_TOKENS.PLACE_REPOSITORY);
    embeddingService = module.get(INJECT_TOKENS.EMBEDDING_SERVICE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchPlaces', () => {
    it('should search places and map results to PaginatedPlacesResponseDto', async () => {
      repository.searchPlaces.mockResolvedValue({
        items: [mockRawPlaceRow],
        total: 1,
      });

      const result = await service.searchPlaces({
        areaId: 1,
        categorySlugs: ['ca-phe'],
        sortBy: PlaceSortBy.RATING,
        sortOrder: SortOrder.DESC,
        page: 1,
        limit: 10,
      });

      expect(repository.searchPlaces).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(mockRawPlaceRow.id);
      expect(result.items[0].name).toBe('Art Coffee');
      expect(result.items[0].category?.slug).toBe('ca-phe');
      expect(result.items[0].area?.slug).toBe('da-nang');
      expect(result.items[0].distanceMeters).toBe(350);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter out closed places when openNow is true', async () => {
      const closedPlaceRow = {
        ...mockRawPlaceRow,
        id: 'a0000000-0000-0000-0000-000000000002',
        opening_hours: '03:00-04:00',
      };

      repository.searchPlaces.mockResolvedValue({
        items: [mockRawPlaceRow, closedPlaceRow],
        total: 2,
      });

      const result = await service.searchPlaces({
        areaId: 1,
        openNow: true,
      });

      expect(repository.searchPlaces).toHaveBeenCalledTimes(1);
      expect(result.items.every((p) => p.isOpenNow === true)).toBe(true);
    });
  });

  describe('searchSemantic', () => {
    it('should generate vector from text query and return places with similarityScore', async () => {
      repository.searchSemantic.mockResolvedValue([mockRawPlaceRow]);

      const result = await service.searchSemantic({
        query: 'quán cafe view biển yên tĩnh',
        areaId: 1,
        limit: 5,
        minSimilarity: 0.5,
      });

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('quán cafe view biển yên tĩnh');
      expect(repository.searchSemantic).toHaveBeenCalledWith(
        expect.any(Array),
        5,
        1,
        0.5,
      );
      expect(result).toHaveLength(1);
      expect(result[0].similarityScore).toBe(0.895);
    });
  });

  describe('syncEmbeddings', () => {
    it('should generate and save embeddings for places missing them', async () => {
      const mockUnembeddedPlace = {
        id: 'p-1',
        name: 'Mỳ Quảng 1A',
        address: '1A Hải Phòng, Đà Nẵng',
        description: 'Mỳ quảng truyền thống ngon',
        tags: ['my-quang', 'an-sang'],
        category: { name: 'Nha hang', nameVi: 'Nhà hàng' },
      };

      repository.findPlacesWithoutEmbedding.mockResolvedValue([mockUnembeddedPlace]);

      const result = await service.syncEmbeddings({ limit: 10, areaId: 1 });

      expect(repository.findPlacesWithoutEmbedding).toHaveBeenCalledWith(10, 1);
      expect(embeddingService.generateEmbedding).toHaveBeenCalledTimes(1);
      expect(repository.upsertPlaceEmbedding).toHaveBeenCalledWith(
        'p-1',
        expect.stringContaining('Mỳ Quảng 1A'),
        expect.any(Array),
        'models/gemini-embedding-2',
      );
      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  describe('getNearbyPlaces', () => {
    it('should return nearby places mapped to PlaceItemDto', async () => {
      repository.findNearby.mockResolvedValue([mockRawPlaceRow]);

      const result = await service.getNearbyPlaces({
        lat: 16.054,
        lng: 108.202,
        radiusMeters: 2000,
        categorySlug: 'ca-phe',
      });

      expect(repository.findNearby).toHaveBeenCalledWith({
        lat: 16.054,
        lng: 108.202,
        radiusMeters: 2000,
        categorySlug: 'ca-phe',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockRawPlaceRow.id);
      expect(result[0].distanceMeters).toBe(350);
    });
  });

  describe('getPlaceById', () => {
    it('should return PlaceDetailDto with images and sources', async () => {
      const mockDetailedPlace = {
        id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Art Coffee',
        description: 'Nice cafe',
        address: '77 Thach Lam',
        district: 'Son Tra',
        city: 'Da Nang',
        latitude: 16.054,
        longitude: 108.202,
        priceLevel: BudgetLevel.MEDIUM,
        priceRange: { min: 25000, max: 60000 },
        openingHours: '07:00-22:00',
        phone: '+84 98 551 13 24',
        website: 'https://artcoffee.vn',
        ratingAvg: 4.6,
        reviewCount: 25,
        imageCount: 2,
        tags: ['cafe', 'wifi', 'view-bien'],
        attributes: { wifi: true, air_conditioned: true },
        category: {
          id: 1,
          name: 'Ca phe',
          nameVi: 'Cà phê',
          slug: 'ca-phe',
          iconUrl: null,
        },
        area: {
          id: 1,
          name: 'Da Nang',
          nameVi: 'Đà Nẵng',
          slug: 'da-nang',
        },
        images: [
          {
            id: 'img-1',
            imageUrl: 'https://img.tripgenie.app/1.jpg',
            thumbnailUrl: null,
            isPrimary: true,
            caption: 'Front view',
          },
        ],
        sources: [
          {
            provider: 'osm',
            externalUrl: 'https://osm.org/node/123',
            sourceRating: null,
            sourceReviewCount: null,
          },
        ],
      };

      repository.findById.mockResolvedValue(mockDetailedPlace);

      const result = await service.getPlaceById('a0000000-0000-0000-0000-000000000001');

      expect(repository.findById).toHaveBeenCalledWith('a0000000-0000-0000-0000-000000000001');
      expect(result.name).toBe('Art Coffee');
      expect(result.images).toHaveLength(1);
      expect(result.sources).toHaveLength(1);
      expect(result.tags).toContain('view-bien');
    });

    it('should throw NotFoundException if place does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getPlaceById('a0000000-0000-0000-0000-000000000999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCategories', () => {
    it('should return list of categories with placeCount', async () => {
      repository.findCategories.mockResolvedValue([
        {
          id: 1,
          name: 'Ca phe',
          nameVi: 'Cà phê',
          slug: 'ca-phe',
          iconUrl: 'https://icons/cafe.svg',
          sortOrder: 1,
          _count: { places: 930 },
        },
      ]);

      const result = await service.getCategories();

      expect(repository.findCategories).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('ca-phe');
      expect(result[0].placeCount).toBe(930);
    });
  });

  describe('getTravelAreas', () => {
    it('should return list of travel areas with bounding box', async () => {
      repository.findTravelAreas.mockResolvedValue([
        {
          id: 1,
          name: 'Da Nang',
          nameVi: 'Đà Nẵng',
          slug: 'da-nang',
          type: 'PROVINCE',
          bboxMinLat: 15.97,
          bboxMaxLat: 16.16,
          bboxMinLng: 107.98,
          bboxMaxLng: 108.36,
        },
      ]);

      const result = await service.getTravelAreas();

      expect(repository.findTravelAreas).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('da-nang');
      expect(result[0].bbox.minLat).toBe(15.97);
    });
  });

  describe('checkIsOpenNow', () => {
    it('should return true for 24/7', () => {
      expect(service.checkIsOpenNow('24/7')).toBe(true);
      expect(service.checkIsOpenNow(' 24/7 ')).toBe(true);
    });

    it('should return boolean for valid time range', () => {
      const res = service.checkIsOpenNow('00:00-23:59');
      expect(typeof res).toBe('boolean');
    });

    it('should return null for invalid or empty string', () => {
      expect(service.checkIsOpenNow(null)).toBeNull();
      expect(service.checkIsOpenNow(undefined)).toBeNull();
      expect(service.checkIsOpenNow('not-a-time')).toBeNull();
    });

    it('should support object with openNow or is_open boolean', () => {
      expect(service.checkIsOpenNow({ openNow: true })).toBe(true);
      expect(service.checkIsOpenNow({ is_open: false })).toBe(false);
    });
  });
});
