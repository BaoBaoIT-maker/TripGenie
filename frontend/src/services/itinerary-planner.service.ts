import type {
  GenerateItineraryRequest,
  TransitPreviewRequest,
  TransitMode,
  IntercityTransit,
  ItineraryDetail,
} from '@/types/itinerary';

const BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Typed API error. status === 401 means "cần đăng nhập". */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Generic fetch wrapper – parse the {statusCode,data} envelope, throw on !ok. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const text = await res.text();
  let body: { data?: T; message?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(
      res.status,
      `Không thể đọc dữ liệu từ máy chủ (HTTP ${res.status}). Vui lòng kiểm tra backend.`
    );
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.message ?? `HTTP ${res.status}`,
    );
  }
  if (body.data === undefined) {
    throw new ApiError(res.status, 'Phản hồi không hợp lệ từ server');
  }
  return body.data;
}

export const itineraryService = {
  previewTransit: (dto: TransitPreviewRequest) =>
    request<IntercityTransit>('/itineraries/transit-preview', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  generateItinerary: (dto: GenerateItineraryRequest) =>
    request<ItineraryDetail>('/itineraries/generate', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getItinerary: (id: string) => request<ItineraryDetail>(`/itineraries/${id}`),

  listItineraries: () => request<ItineraryDetail[]>('/itineraries'),

  deleteItinerary: (id: string) =>
    request<{ success: boolean; id: string }>(`/itineraries/${id}`, {
      method: 'DELETE',
    }),

  cloneItinerary: (id: string) =>
    request<ItineraryDetail>(`/itineraries/${id}/clone`, {
      method: 'POST',
    }),

  bulkDeleteItineraries: (ids: string[]) =>
    request<{ success: boolean; count: number }>('/itineraries/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  updateTransitMode: (id: string, transitMode: TransitMode) =>
    request<ItineraryDetail>(`/itineraries/${id}/transit-mode`, {
      method: 'PATCH',
      body: JSON.stringify({ transitMode }),
    }),
};
