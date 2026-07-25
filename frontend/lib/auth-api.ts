import {
  apiRequest,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './api-client';

export type Caregiver = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export type AuthResponse = {
  caregiver: Caregiver;
  access: string;
  refresh: string;
  token_type?: string;
};

export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
  const res = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: { email, password, name },
  });
  await setTokens(res.access, res.refresh);
  return res;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
  await setTokens(res.access, res.refresh);
  return res;
}

export async function fetchMe(): Promise<Caregiver> {
  return apiRequest<Caregiver>('/auth/me');
}

/** Revokes the refresh token server-side (best effort) and always clears local tokens. */
export async function logout(): Promise<void> {
  const refresh = await getRefreshToken();

  try {
    if (refresh) {
      await apiRequest('/auth/logout', { method: 'POST', body: { refresh } });
    }
  } catch {
    // A failed revoke must not block local sign-out.
  } finally {
    await clearTokens();
  }
}

export async function hasSession(): Promise<boolean> {
  return !!(await getAccessToken());
}
