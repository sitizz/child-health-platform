import { apiRequest } from './api-client';

export type RiskLevel = 'low' | 'moderate' | 'high';

export type ServerChild = {
  id: string;
  caregiver_id: string;
  name: string | null;
  age: number;
  sex: string | null;
  is_selected: boolean;
  conditions: Record<string, boolean>;
  allergies: Record<string, unknown>;
  symptoms: Record<string, boolean>;
  exposures: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

export type ChildCreate = {
  name?: string | null;
  age: number;
  sex?: string | null;
  conditions?: Record<string, boolean>;
  allergies?: Record<string, unknown>;
  symptoms?: Record<string, boolean>;
  exposures?: Record<string, boolean>;
  is_selected?: boolean;
};

export type ChildUpdate = Partial<Omit<ChildCreate, 'is_selected'>>;

export type Explanation = {
  why: string;
  environmental_factors: string[];
  child_factors: string[];
};

export type RecommendationResult = {
  overall_risk: RiskLevel;
  primary_hazards: string[];
  explanation: Explanation;
  priority_actions: string[];
  secondary_actions: string[];
  monitoring_advice: string[];
  escalation_advice: string[];
  disclaimer: string;
  model_version: string;
  data_completeness: 'full' | 'limited';
  environment?: Record<string, number | null> | null;
  risks?: Record<string, string> | null;
  child_id?: string | null;
  assessment_id?: string | null;
};

export function listChildren(): Promise<ServerChild[]> {
  return apiRequest<ServerChild[]>('/children');
}

export function createChild(body: ChildCreate): Promise<ServerChild> {
  return apiRequest<ServerChild>('/children', { method: 'POST', body });
}

export function getChild(id: string): Promise<ServerChild> {
  return apiRequest<ServerChild>(`/children/${id}`);
}

export function updateChild(id: string, body: ChildUpdate): Promise<ServerChild> {
  return apiRequest<ServerChild>(`/children/${id}`, { method: 'PATCH', body });
}

export function deleteChild(id: string): Promise<void> {
  return apiRequest<void>(`/children/${id}`, { method: 'DELETE' });
}

export function selectServerChild(id: string): Promise<ServerChild> {
  return apiRequest<ServerChild>(`/children/${id}/select`, { method: 'POST' });
}

/** Persists an assessment for history/panel and returns the recommendation. */
export function getChildRecommendations(
  id: string,
  lat: number,
  lon: number
): Promise<RecommendationResult> {
  return apiRequest<RecommendationResult>(`/children/${id}/recommendations`, {
    query: { lat, lon },
  });
}

/** Stateless evaluation (does not persist); used for inline/ad-hoc profiles. */
export function evaluateRecommendations(body: {
  lat: number;
  lon: number;
  child_id?: string | null;
  age?: number | null;
  conditions?: Record<string, boolean>;
  symptoms?: Record<string, boolean>;
  exposures?: Record<string, boolean>;
  allergies?: Record<string, unknown>;
}): Promise<RecommendationResult> {
  return apiRequest<RecommendationResult>('/recommendations/evaluate', { method: 'POST', body });
}
