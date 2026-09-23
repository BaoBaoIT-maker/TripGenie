import { Module } from '@nestjs/common';
import { AddressNormalizerService } from './services/address-normalizer.service';
import { GeoJsonService } from './services/geojson.service';
import { OverpassApiProvider } from './providers/overpass-api.provider';

@Module({
  providers: [AddressNormalizerService, GeoJsonService, OverpassApiProvider],
  exports: [AddressNormalizerService, GeoJsonService, OverpassApiProvider],
})
export class GeoModule {}
