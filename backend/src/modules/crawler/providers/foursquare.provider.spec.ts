import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FoursquareProvider } from './foursquare.provider';

describe('FoursquareProvider', () => {
  let provider: FoursquareProvider;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'FOURSQUARE_API_KEY') return 'mock_fsq_key';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoursquareProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<FoursquareProvider>(FoursquareProvider);
  });

  it('should be defined', () => expect(provider).toBeDefined());

  it('should return null gracefully if FOURSQUARE_API_KEY is not configured', async () => {
    mockConfigService.get.mockReturnValue('');
    const unconfiguredModule = await Test.createTestingModule({
      providers: [
        FoursquareProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    const unconfiguredProvider = unconfiguredModule.get<FoursquareProvider>(FoursquareProvider);
    const result = await unconfiguredProvider.enrichPlace('Test Place', 16.0, 108.2);

    expect(result).toBeNull();
  });
});
