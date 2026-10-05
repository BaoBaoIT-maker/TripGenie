import { Module } from '@nestjs/common';
import { GeoJsonService } from './services/geojson.service';

@Module({
  providers: [GeoJsonService],
  exports: [GeoJsonService],
})
export class GeoModule {}
