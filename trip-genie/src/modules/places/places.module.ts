import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { PlacesRepository } from './places.repository';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';

@Module({
  controllers: [PlacesController],
  providers: [
    PlacesService,
    {
      provide: INJECT_TOKENS.PLACE_REPOSITORY,
      useClass: PlacesRepository,
    },
  ],
  exports: [PlacesService, INJECT_TOKENS.PLACE_REPOSITORY],
})
export class PlacesModule {}
