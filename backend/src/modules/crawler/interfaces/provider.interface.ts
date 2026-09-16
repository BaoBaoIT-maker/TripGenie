export interface OsmNode {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface NormalizedPlace {
  externalId: string;
  provider: string;
  name: string;
  nameNormalized: string;
  latitude: number;
  longitude: number;
  address: string | null;
  description: string | null;
  categorySlug: string;
  tags: string[];
  phone?: string | null;
  website?: string | null;
  openingHours?: string | null;
  wikidata?: string | null;
  image?: string | null;
  sourceData: Record<string, any>;
}

export interface ICrawlerProvider {
  fetchByBbox(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
    categories?: string[],
  ): Promise<NormalizedPlace[]>;
}
