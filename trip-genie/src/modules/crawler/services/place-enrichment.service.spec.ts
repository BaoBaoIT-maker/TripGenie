import { Test, TestingModule } from '@nestjs/testing';
import { PlaceEnrichmentService } from './place-enrichment.service';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { BudgetLevel } from '@prisma/client';

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
    sources: [
      { rawData: { tags: { wikidata: 'Q379681' } } },
    ],
  };

  beforeEach(async () => {
    crawlerRepo = {
      getPlaceById: jest.fn().mockResolvedValue(mockPlace),
      getUnenrichedPlacesByArea: jest.fn().mockResolvedValue([mockPlace]),
      updatePlace: jest.fn().mockResolvedValue({ ...mockPlace, ratingAvg: 4.5 }),
      createPlaceImages: jest.fn().mockResolvedValue(1),
    };

    foursquareProvider = {
      providerName: 'foursquare',
      enrichPlace: jest.fn().mockResolvedValue({
        ratingAvg: 4.5,
        reviewCount: 120,
        budgetLevel: BudgetLevel.MEDIUM,
        phone: '+842353861705',
        website: 'https://hoian.gov.vn',
        photoUrls: ['https://foursquare.com/hoian.jpg'],
      }),
    };

    wikimediaProvider = {
      providerName: 'wikimedia',
      enrichPlace: jest.fn().mockResolvedValue({
        description: 'Phố cổ Hội An là một đô thị cổ nằm ở hạ lưu sông Thu Bồn.',
        photoUrls: ['https://upload.wikimedia.org/hoian.jpg'],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaceEnrichmentService,
        { provide: INJECT_TOKENS.CRAWLER_REPOSITORY, useValue: crawlerRepo },
        { provide: INJECT_TOKENS.ENRICHMENT_PROVIDERS, useValue: [wikimediaProvider, foursquareProvider] },
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

  it('should perform safe partial update when providers return data and save images', async () => {
    const result = await service.enrichPlaceById('place-uuid-1');

    expect(result).toBe(true);
    expect(crawlerRepo.updatePlace).toHaveBeenCalledWith(
      'place-uuid-1',
      expect.objectContaining({
        description: expect.any(String),
        ratingAvg: 4.5,
        reviewCount: 120,
        priceLevel: BudgetLevel.MEDIUM,
        phone: '+842353861705',
        website: 'https://hoian.gov.vn',
      }),
    );
    expect(crawlerRepo.createPlaceImages).toHaveBeenCalledTimes(2);
  });

  it('should enrich batch of unenriched places by areaId', async () => {
    const result = await service.enrichPlacesByArea(1, 50);

    expect(result.processed).toBe(1);
    expect(result.enriched).toBe(1);
    expect(crawlerRepo.getUnenrichedPlacesByArea).toHaveBeenCalledWith(1, 50);
  });
});
