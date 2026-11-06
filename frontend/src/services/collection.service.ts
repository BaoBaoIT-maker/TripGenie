import { apiClient } from '@/lib/api-client';

export const DEFAULT_COLLECTION_TITLE = 'Yêu thích';

export interface CollectionSummary {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { places: number };
  previewImages: string[];
}

export interface CollectionPlaceItem {
  collectionId: string;
  placeId: string;
  notes: string | null;
  addedAt: string;
  place: {
    id: string;
    name: string;
    description?: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
    ratingAvg: number | null;
    reviewCount: number | null;
    priceLevel: string | null;
    priceRange: unknown;
    category: {
      name: string;
      nameVi: string | null;
      slug: string;
    } | null;
    area?: {
      name: string;
      nameVi: string | null;
      slug: string;
    } | null;
    images: {
      imageUrl: string;
      thumbnailUrl: string | null;
    }[];
  };
}

export interface CollectionDetail {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { places: number };
  places: CollectionPlaceItem[];
}

export interface CreateCollectionPayload {
  title: string;
  description?: string;
  isPublic?: boolean;
  coverImage?: string;
}

export interface UpdateCollectionPayload {
  title?: string;
  description?: string;
  isPublic?: boolean;
  coverImage?: string;
}

export const collectionService = {
  async getMyCollections(): Promise<CollectionSummary[]> {
    const res = await apiClient<{ collections: CollectionSummary[] }>('/collections');
    return res.collections || [];
  },

  async getSavedPlaceIds(): Promise<string[]> {
    const res = await apiClient<{ savedPlaceIds: string[] }>('/collections/saved-place-ids');
    return res.savedPlaceIds || [];
  },

  async getCollectionsContainingPlace(placeId: string): Promise<string[]> {
    const res = await apiClient<{ collectionIds: string[] }>(
      `/collections/containing/${placeId}`,
    );
    return res.collectionIds || [];
  },

  async getCollectionDetail(id: string): Promise<CollectionDetail> {
    const res = await apiClient<{ collection: CollectionDetail }>(`/collections/${id}`);
    return res.collection;
  },

  async createCollection(payload: CreateCollectionPayload): Promise<CollectionSummary> {
    const res = await apiClient<{ collection: CollectionSummary }>('/collections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.collection;
  },

  async updateCollection(id: string, payload: UpdateCollectionPayload): Promise<CollectionSummary> {
    const res = await apiClient<{ collection: CollectionSummary }>(`/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.collection;
  },

  async deleteCollection(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(`/collections/${id}`, {
      method: 'DELETE',
    });
  },

  async togglePlace(
    placeId: string,
    collectionId?: string,
  ): Promise<{ isSaved: boolean; collectionId: string; placeId: string }> {
    return apiClient<{ isSaved: boolean; collectionId: string; placeId: string }>(
      '/collections/toggle',
      {
        method: 'POST',
        body: JSON.stringify({ placeId, collectionId }),
      },
    );
  },

  async addPlace(
    collectionId: string,
    placeId: string,
    notes?: string,
  ): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/collections/${collectionId}/places`, {
      method: 'POST',
      body: JSON.stringify({ placeId, notes }),
    });
  },

  async removePlace(
    collectionId: string,
    placeId: string,
  ): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/collections/${collectionId}/places/${placeId}`,
      {
        method: 'DELETE',
      },
    );
  },
};
