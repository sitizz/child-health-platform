import { apiRequest } from './api-client';
import type { RecommendationResult, RiskLevel, ServerChild } from './children-api';

export type ChildRiskSummary = {
  child: ServerChild;
  latest_priority: RiskLevel | null;
  latest_assessment_at: string | null;
  latest_hazards: string[];
};

export type PanelOverview = {
  selected_child_id: string | null;
  children: ChildRiskSummary[];
  open_alerts_count: number;
  consent_accepted: boolean;
  disclaimer_acknowledged: boolean;
  household_priority: RiskLevel | null;
};

export type HistoryItem = {
  id: string;
  kind: 'assessment' | 'notification' | string;
  child_id: string | null;
  priority: RiskLevel | null;
  title: string | null;
  body: string | null;
  summary: Record<string, unknown> | null;
  created_at: string;
};

export function getPanelOverview(): Promise<PanelOverview> {
  return apiRequest<PanelOverview>('/panel/overview');
}

export function getPanelHistory(): Promise<{ items: HistoryItem[] }> {
  return apiRequest<{ items: HistoryItem[] }>('/panel/history');
}

export function getPanelRecommendations(): Promise<{ items: RecommendationResult[] }> {
  return apiRequest<{ items: RecommendationResult[] }>('/panel/recommendations');
}
