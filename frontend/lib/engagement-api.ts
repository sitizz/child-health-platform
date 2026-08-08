import { apiRequest } from './api-client';

export type EngagementEventType = 'add_child' | 'share_summary' | 'risk_check';

export type EngagementMetrics = {
  total_events: number;
  by_type: Record<EngagementEventType, number>;
  daily: {
    date: string;
    add_child: number;
    share_summary: number;
    risk_check: number;
  }[];
};

/**
 * Logs an engagement event. JWT is optional server-side, but we send it (default
 * auth) so events attribute to the caregiver. Never call this for `add_child` —
 * the server auto-logs that on POST /children. Fire-and-forget: a tracking
 * failure must never disrupt the user flow.
 */
export async function trackEvent(
  event_type: Exclude<EngagementEventType, 'add_child'>,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await apiRequest('/engagement/track', { method: 'POST', body: { event_type, metadata } });
  } catch (err) {
    console.warn('[engagement] track failed (ignored):', err);
  }
}

export function getEngagementMetrics(fromDate?: string, toDate?: string): Promise<EngagementMetrics> {
  return apiRequest<EngagementMetrics>('/engagement/metrics', {
    query: { from_date: fromDate, to_date: toDate },
  });
}
