import { Test, TestingModule } from '@nestjs/testing';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import { NearbyPlacesDto } from './dto/nearby-places.dto';
import { PlaceSortBy, SortOrder } from '../../common/enums/places.enum';

describe('PlacesController', () => {
  let controller: PlacesController;
  let service: jest.Mocked<PlacesService>;

  const mockPlaceItem = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Art Coffee',
    description: 'Nice cafe',
    address: '77 Thach Lam, Da Nang',
    district: 'Son Tra',
    city: 'Da Nang',
    latitude: 16.054,
    longitude: 108.202,
    distanceMeters: 350,
    ratingAvg: 4.6,
    reviewCount: 25,
    imageCount: 3,
    priceLevel: null,
    phone: '+84 98 551 13 24',
    website: 'https://artcoffee.vn',
    openingHours: null,
    isOpenNow: true,
    primaryImage: 'https://images.tripgenie.app/artcoffee.jpg',
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
  };

  beforeEach(async () => {
    const mockService: Partial<jest.Mocked<PlacesService>> = {
      searchPlaces: jest.fn(),
      getNearbyPlaces: jest.fn(),
      getCategories: jest.fn(),
      getTravelAreas: jest.fn(),
      getPlaceById: jest.fn(),
      searchSemantic: jest.fn(),
      syncEmbeddings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlacesController],
      providers: [
        {
          provide: PlacesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PlacesController>(PlacesController);
    service = module.get(PlacesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /places/search', () => {
    it('should return paginated places matching criteria', async () => {
      const mockResult = {
        items: [mockPlaceItem],
        meta: { totalItems: 1, page: 1, limit: 20, totalPages: 1 },
      };
      service.searchPlaces.mockResolvedValue(mockResult);

      const dto: SearchPlacesDto = {
        keyword: 'Art Coffee',
        areaId: 1,
        categorySlugs: ['ca-phe'],
        sortBy: PlaceSortBy.RATING,
        sortOrder: SortOrder.DESC,
      };

      const result = await controller.searchPlaces(dto);

      expect(service.searchPlaces).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('GET /places/nearby', () => {
    it('should return nearby places', async () => {
      service.getNearbyPlaces.mockResolvedValue([mockPlaceItem]);

      const dto: NearbyPlacesDto = {
        lat: 16.054,
        lng: 108.202,
        radiusMeters: 3000,
      };

      const result = await controller.getNearbyPlaces(dto);

      expect(service.getNearbyPlaces).toHaveBeenCalledWith(dto);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockPlaceItem.id);
    });
  });

  describe('GET /places/categories', () => {
    it('should return list of categories', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'Ca phe',
          nameVi: 'Cà phê',
          slug: 'ca-phe',
          iconUrl: null,
          sortOrder: 1,
          placeCount: 930,
        },
      ];
      service.getCategories.mockResolvedValue(mockCategories);

      const result = await controller.getCategories();

      expect(service.getCategories).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockCategories);
    });
  });

  describe('GET /places/travel-areas', () => {
    it('should return list of travel areas', async () => {
      const mockAreas = [
        {
          id: 1,
          name: 'Da Nang',
          nameVi: 'Đà Nẵng',
          slug: 'da-nang',
          type: 'PROVINCE',
          bbox: { minLat: 15.97, maxLat: 16.16, minLng: 107.98, maxLng: 108.36 },
        },
      ];
      service.getTravelAreas.mockResolvedValue(mockAreas);

      const result = await controller.getTravelAreas();

      expect(service.getTravelAreas).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAreas);
    });
  });

  describe('GET /places/:id', () => {
    it('should return detail of single place', async () => {
      const mockDetail = {
        ...mockPlaceItem,
        priceRange: null,
        tags: ['cafe'],
        attributes: {},
        images: [],
        sources: [],
      };
      service.getPlaceById.mockResolvedValue(mockDetail);

      const result = await controller.getPlaceById(mockPlaceItem.id);

      expect(service.getPlaceById).toHaveBeenCalledWith(mockPlaceItem.id);
      expect(result).toEqual(mockDetail);
    });
  });

  describe('GET /places/semantic-search', () => {
    it('should call placesService.searchSemantic with dto', async () => {
      const mockResult = [{ ...mockPlaceItem, similarityScore: 0.88 }];
      service.searchSemantic.mockResolvedValue(mockResult);

      const dto = { query: 'quán cafe đẹp', areaId: 1, limit: 10 };
      const result = await controller.searchSemantic(dto);

      expect(service.searchSemantic).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('POST /places/sync-embeddings', () => {
    it('should call placesService.syncEmbeddings with dto', async () => {
      const mockSyncResult = { processed: 10, succeeded: 10, failed: 0 };
      service.syncEmbeddings.mockResolvedValue(mockSyncResult);

      const dto = { batchSize: 10, areaId: 1 };
      const result = await controller.syncEmbeddings(dto);

      expect(service.syncEmbeddings).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockSyncResult);
    });
  });
});
