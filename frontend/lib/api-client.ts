import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_KEY, API_URL, ApiError } from './api';

const PREFIX = '/api/v1';
const TIMEOUT_MS = 60000; // Render free-tier cold starts can be slow.

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

// Server supports these; anything else negotiates to English.
const SUPPORTED_LANGUAGES = ['en', 'ms', 'ur', 'id'];

function deviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
    const base = locale.split('-')[0].toLowerCase();
    return SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
  } catch {
    return 'en';
  }
}

// Negotiates translated `simplified` / disclaimer copy where the server has it.
const ACCEPT_LANGUAGE = `${deviceLanguage()},en;q=0.8`;

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_KEY);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_KEY, access],
    [REFRESH_KEY, refresh],
  ]);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Attach the caregiver Bearer token (default true). */
  auth?: boolean;
  /** Query params appended to the path. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Internal: prevents infinite refresh loops. */
  _retried?: boolean;
};

async function rawFetch(
  method: string,
  path: string,
  body: unknown,
  access: string | null
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = { 'Accept-Language': ACCEPT_LANGUAGE };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
  if (access) headers.Authorization = `Bearer ${access}`;

  try {
    return await fetch(`${API_URL}${PREFIX}${path}`, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Single-flight refresh: many requests failing 401 at once share one refresh.
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refresh = await getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await rawFetch('POST', '/auth/refresh', { refresh }, null);
    if (!res.ok) return false;

    const data = await res.json();
    if (data?.access && data?.refresh) {
      await setTokens(data.access, data.refresh);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function buildPath(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Typed request wrapper. Injects the API key and Bearer token, refreshes once on
 * a 401 from an expired access token, and maps the server error envelope into an
 * ApiError that carries the `code` (so screens can route 403 consent/disclaimer
 * gates) and a caregiver-facing `message`.
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query, _retried = false } = opts;

  const access = auth ? await getAccessToken() : null;
  const fullPath = buildPath(path, query);

  let res: Response;
  try {
    res = await rawFetch(method, fullPath, body, access);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, 'The request timed out. Please try again.');
    }
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.');
  }

  if (res.status === 401 && auth && !_retried) {
    if (!refreshPromise) {
      refreshPromise = refreshTokens().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;

    if (refreshed) {
      return apiRequest<T>(path, { ...opts, _retried: true });
    }

    await clearTokens();
    throw new ApiError(401, 'Your session has expired. Please sign in again.', 'unauthorized');
  }

  if (!res.ok) {
    throw await toApiError(res);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = 'Something went wrong. Please try again.';
  let code: string | undefined;

  try {
    const data = await res.json();
    const err = data?.error;
    if (err) {
      if (typeof err.message === 'string') message = err.message;
      code = err.code ?? (res.status === 403 ? err.message : undefined);
    }
  } catch {
    // Non-JSON error body — keep the default message.
  }

  // Caregiver-facing overrides for statuses whose raw message is unhelpful.
  if (res.status === 403) message = 'Please complete consent and the safety notice to continue.';
  if (res.status === 429) message = 'Too many requests. Please wait a moment and try again.';
  if (res.status === 503) message = 'Environmental data is temporarily unavailable. Please try again shortly.';

  return new ApiError(res.status, message, code);
}

export function needsConsent(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && (err.code === 'consent_required');
}

export function needsDisclaimer(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && (err.code === 'disclaimer_required');
}

export function isSessionExpired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}
