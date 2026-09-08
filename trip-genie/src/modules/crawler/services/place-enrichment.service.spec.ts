import { Test, TestingModule } from '@nestjs/testing';
import { PlaceEnrichmentService } from './place-enrichment.service';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';

describe('PlaceEnrichmentService', () => {
  let service: PlaceEnrichmentService;
  let crawlerRepo: any;
  let foursquareProvider: any;
  let wikimediaProvider: any;

  const mockPlace = {
    id: 'place-uuid-1',
    name: 'Phố Cổ Hội An',
    latitude: 15.88,
    longitude: 108.33,
    description: null,
    ratingAvg: null,
    priceLevel: null,
    openingHours: null,
    phone: null,
    website: null,
  };

  beforeEach(async () => {
    crawlerRepo = {
      getPlaceById: jest.fn().mockResolvedValue(mockPlace),
      getUnenrichedPlacesByArea: jest.fn().mockResolvedValue([mockPlace]),
      updatePlace: jest.fn().mockResolvedValue({ ...mockPlace, ratingAvg: 4.5 }),
    };

    foursquareProvider = {
      enrichPlace: jest.fn().mockResolvedValue({
        ratingAvg: 4.5,
        ratingCount: 120,
        priceLevel: 2,
        phone: '+842353861705',
        website: 'https://hoian.gov.vn',
      }),
    };

    wikimediaProvider = {
      enrichPlace: jest.fn().mockResolvedValue({
        description: 'Phố cổ Hội An là một đô thị cổ nằm ở hạ lưu sông Thu Bồn.',
        photoUrls: ['https://upload.wikimedia.org/hoian.jpg'],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaceEnrichmentService,
        { provide: INJECT_TOKENS.CRAWLER_REPOSITORY, useValue: crawlerRepo },
        { provide: INJECT_TOKENS.FOURSQUARE_PROVIDER, useValue: foursquareProvider },
        { provide: INJECT_TOKENS.WIKIMEDIA_PROVIDER, useValue: wikimediaProvider },
      ],
    }).compile();

    service = module.get<PlaceEnrichmentService>(PlaceEnrichmentService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('should return false if placeId is not found', async () => {
    crawlerRepo.getPlaceById.mockResolvedValue(null);
    const result = await service.enrichPlaceById('invalid-id');
    expect(result).toBe(false);
    expect(crawlerRepo.updatePlace).not.toHaveBeenCalled();
  });

  it('should perform safe partial update when providers return data', async () => {
    const result = await service.enrichPlaceById('place-uuid-1');

    expect(result).toBe(true);
    expect(crawlerRepo.updatePlace).toHaveBeenCalledWith(
      'place-uuid-1',
      expect.objectContaining({
        description: expect.any(String),
        ratingAvg: 4.5,
        ratingCount: 120,
        priceLevel: 2,
        phone: '+842353861705',
        website: 'https://hoian.gov.vn',
      }),
    );
  });

  it('should enrich batch of unenriched places by areaId', async () => {
    const result = await service.enrichPlacesByArea(1, 50);

    expect(result.processed).toBe(1);
    expect(result.enriched).toBe(1);
    expect(crawlerRepo.getUnenrichedPlacesByArea).toHaveBeenCalledWith(1, 50);
  });
});
