import { apiRequest } from './api-client';

export type Device = {
  id: string;
  expo_push_token: string;
  platform: string | null;
  active: boolean;
  last_seen_at: string;
};

export function registerDevice(expo_push_token: string, platform?: string): Promise<Device> {
  return apiRequest<Device>('/devices', {
    method: 'POST',
    body: { expo_push_token, platform },
  });
}

export function deleteDevice(token: string): Promise<void> {
  return apiRequest<void>(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
}

export function sendTestNotification(title?: string, body?: string): Promise<unknown> {
  return apiRequest('/notifications/test', {
    method: 'POST',
    body: { title, body },
  });
}
