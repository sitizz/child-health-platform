import { apiRequest } from './api-client';
import type { MlPrediction } from './children-api';

export type MlStatus = {
  classifier_loaded: boolean;
  classifier_version: string;
  feature_names: string[];
  risk_domains: string[];
  vision_status: string;
  audio_status: string;
  supported_languages: string[];
  llm_enabled: boolean;
  llm_provider?: string | null;
  llm_model?: string | null;
};

export type MlLanguages = { supported: string[]; default: string; negotiated: string };

// ML routes are API-key only (no JWT gate).
export function getMlStatus(): Promise<MlStatus> {
  return apiRequest<MlStatus>('/ml/status', { auth: false });
}

export function getMlLanguages(): Promise<MlLanguages> {
  return apiRequest<MlLanguages>('/ml/languages', { auth: false });
}

/** Direct triage without fetching weather (offline demos / tests). */
export function mlPredict(body: {
  age_group: 'under5' | 'child' | 'adolescent';
  asthma?: boolean;
  fever?: boolean;
  cough?: boolean;
  dehydration?: boolean;
  mosquito_exposure?: boolean;
  flood_exposure?: boolean;
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  aqi?: number;
  pm2_5?: number;
  pm10?: number;
}): Promise<{ prediction: MlPrediction; disclaimer: string }> {
  return apiRequest('/ml/predict', { method: 'POST', auth: false, body });
}
