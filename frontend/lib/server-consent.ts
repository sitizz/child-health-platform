import { apiRequest } from './api-client';

export type ConsentCheckboxes = {
  caregiver_authority: boolean;
  read_understood: boolean;
  not_diagnostic: boolean;
  data_processing: boolean;
  location: boolean;
  notifications_opt_in?: boolean;
};

export type ConsentCurrent = {
  version: string;
  title: string;
  subtitle: string;
  about: string;
  information_we_collect: string[];
  how_information_is_used: string[];
  medical_disclaimer: string;
  privacy: string;
  required_checkboxes: string[];
  optional_checkboxes: string[];
  privacy_policy_url: string;
  terms_url: string;
};

export type ConsentStatus = {
  accepted: boolean;
  version: string | null;
  current_version: string;
  notifications_opt_in?: boolean;
  accepted_at?: string | null;
  withdrawn_at?: string | null;
  consent_id?: string | null;
};

export type DisclaimerCurrent = { version: string; text: string };

export type DisclaimerStatus = {
  acknowledged: boolean;
  version: string | null;
  current_version: string;
  acknowledged_at?: string | null;
};

export function getConsentCurrent(): Promise<ConsentCurrent> {
  return apiRequest<ConsentCurrent>('/consent/current', { auth: false });
}

export function getConsentStatus(): Promise<ConsentStatus> {
  return apiRequest<ConsentStatus>('/consent/status');
}

export function acceptConsent(checkboxes: ConsentCheckboxes): Promise<ConsentStatus> {
  return apiRequest<ConsentStatus>('/consent/accept', { method: 'POST', body: { checkboxes } });
}

export function withdrawConsent(): Promise<unknown> {
  return apiRequest('/consent/withdraw', { method: 'POST' });
}

export function getDisclaimerCurrent(): Promise<DisclaimerCurrent> {
  return apiRequest<DisclaimerCurrent>('/disclaimer/current', { auth: false });
}

export function getDisclaimerStatus(): Promise<DisclaimerStatus> {
  return apiRequest<DisclaimerStatus>('/disclaimer/status');
}

export function acknowledgeDisclaimer(): Promise<DisclaimerStatus> {
  return apiRequest<DisclaimerStatus>('/disclaimer/acknowledge', { method: 'POST', body: {} });
}

/** True when both gates are satisfied for the current server versions. */
export async function isOnboardingComplete(): Promise<boolean> {
  const [consent, disclaimer] = await Promise.all([getConsentStatus(), getDisclaimerStatus()]);
  return consent.accepted && disclaimer.acknowledged;
}
