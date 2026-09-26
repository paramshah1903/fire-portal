import axios, { AxiosError } from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    // Skips the ngrok free-tier browser-interstitial for API calls.
    // Harmless when the app is hosted anywhere else.
    'ngrok-skip-browser-warning': 'true',
  },
});

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

/**
 * Normalises an axios/network/server error into a message + code the
 * UI can act on. Prefer this over spreading `error.response?.data` everywhere.
 */
export function toApiError(err: unknown): {
  code: string;
  message: string;
  status: number;
} {
  if (err instanceof AxiosError) {
    const data = err.response?.data as Partial<ApiErrorShape> | undefined;
    const shaped = data?.error;
    return {
      code: shaped?.code ?? 'NETWORK_ERROR',
      message:
        shaped?.message ??
        (err.code === 'ECONNABORTED'
          ? 'The request timed out. Please try again.'
          : 'Unable to reach the server. Please try again.'),
      status: err.response?.status ?? 0,
    };
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message, status: 0 };
  }
  return { code: 'UNKNOWN', message: 'Something went wrong.', status: 0 };
}

// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  time: string;
  uptimeSec: number;
  database: 'ok' | 'unavailable';
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
}
