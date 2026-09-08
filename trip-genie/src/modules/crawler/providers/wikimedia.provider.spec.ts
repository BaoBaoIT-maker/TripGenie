import { Test, TestingModule } from '@nestjs/testing';
import { WikimediaProvider } from './wikimedia.provider';

describe('WikimediaProvider', () => {
  let provider: WikimediaProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WikimediaProvider],
    }).compile();

    provider = module.get<WikimediaProvider>(WikimediaProvider);
  });

  it('should be defined', () => expect(provider).toBeDefined());
});
