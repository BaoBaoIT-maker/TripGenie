import { ApiResponse } from '@/types/auth';
import {
  ACCEPT_LANGUAGE_HEADER,
  getActiveClientLocale,
  parseLocale,
} from '@/i18n/config';
import { getMessages, translateApiError } from '@/i18n';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errors?: string[] | Record<string, unknown>,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** Alias for statusCode — matches the legacy ApiError.status interface. */
  get status(): number {
    return this.statusCode;
  }
}

const resolveApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  }
  const backend =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000';
  const clean = backend.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  const cleanBase = clean.startsWith('http') ? clean : 'http://localhost:3000';
  return `${cleanBase}/api/v1`;
};

export const API_BASE_URL = resolveApiBaseUrl();

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

  const activeLocale = headers.has(ACCEPT_LANGUAGE_HEADER)
    ? parseLocale(headers.get(ACCEPT_LANGUAGE_HEADER))
    : getActiveClientLocale();

  if (!headers.has(ACCEPT_LANGUAGE_HEADER)) {
    headers.set(ACCEPT_LANGUAGE_HEADER, activeLocale);
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
      getMessages(activeLocale).errors.NETWORK_UNREACHABLE,
      0,
    );
  }

  // Handle 401 Unauthorized with token refresh (once)
  const isAuthEndpoint =
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/register') ||
    endpoint.includes('/auth/refresh') ||
    options.skipAuthRefresh;

  if (response.status === 401 && !isAuthEndpoint) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry original request once
      try {
        response = await fetch(url, config);
      } catch {
        throw new ApiClientError(
          getMessages(activeLocale).errors.NETWORK_RETRY_FAILED,
          0,
        );
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
    let rawErrorMessage: string | undefined = undefined;
    let errorDetails: unknown = undefined;
    const errorCode = data && typeof data.code === 'string' ? data.code : undefined;

    if (data) {
      if (data.errors !== undefined && data.errors !== null) {
        errorDetails = data.errors;
      }
      if (typeof data.message === 'string') {
        rawErrorMessage = data.message;
      } else if (Array.isArray(data.message) && data.message.length > 0) {
        rawErrorMessage = String(data.message[0]);
        if (!errorDetails) errorDetails = data.message;
      } else if (data.error) {
        rawErrorMessage = String(data.error);
      }
    }

    const localizedMessage = translateApiError(
      {
        code: errorCode,
        message: rawErrorMessage,
        statusCode: response.status,
      },
      activeLocale,
    );

    throw new ApiClientError(
      localizedMessage,
      response.status,
      errorDetails as string[] | Record<string, unknown> | undefined,
      errorCode,
    );
  }

  // If backend wrapped in { statusCode, success, message, data }, return data directly
  if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
    return (data as unknown as ApiResponse<T>).data;
  }

  return data as unknown as T;
}
