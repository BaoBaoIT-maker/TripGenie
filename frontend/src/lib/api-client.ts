import { ApiResponse } from '@/types/auth';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errors?: string[] | Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface RequestOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch {
    throw new ApiClientError(
      'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối mạng.',
      0,
    );
  }

  // Handle 401 Unauthorized with token refresh (once)
  const isAuthEndpoint =
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/register') ||
    endpoint.includes('/auth/refresh') ||
    endpoint.includes('/auth/verify-otp') ||
    options.skipAuthRefresh;

  if (response.status === 401 && !isAuthEndpoint) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry original request once
      try {
        response = await fetch(url, config);
      } catch {
        throw new ApiClientError('Lỗi kết nối khi gửi lại yêu cầu', 0);
      }
    }
  }

  let data: Record<string, unknown> | null = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    let errorDetails: unknown = undefined;

    if (data) {
      if (typeof data.message === 'string') {
        errorMessage = data.message;
      } else if (Array.isArray(data.message) && data.message.length > 0) {
        errorMessage = String(data.message[0]);
        errorDetails = data.message;
      } else if (data.error) {
        errorMessage = String(data.error);
      }
    }

    throw new ApiClientError(errorMessage, response.status, errorDetails as string[] | Record<string, unknown> | undefined);
  }

  // If backend wrapped in { statusCode, success, message, data }, return data directly
  if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
    return (data as unknown as ApiResponse<T>).data;
  }

  return data as unknown as T;
}
