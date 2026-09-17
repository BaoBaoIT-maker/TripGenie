import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { PlacesRepository } from './places.repository';
import { GeminiEmbeddingService } from './services/gemini-embedding.service';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';

@Module({
  controllers: [PlacesController],
  providers: [
    PlacesService,
    {
      provide: INJECT_TOKENS.PLACE_REPOSITORY,
      useClass: PlacesRepository,
    },
    {
      provide: INJECT_TOKENS.EMBEDDING_SERVICE,
      useClass: GeminiEmbeddingService,
    },
  ],
  exports: [
    PlacesService,
    INJECT_TOKENS.PLACE_REPOSITORY,
    INJECT_TOKENS.EMBEDDING_SERVICE,
  ],
})
export class PlacesModule {}
