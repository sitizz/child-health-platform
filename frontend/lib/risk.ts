import type { RiskLevel } from './api';

export const RISK_BG: Record<RiskLevel, string> = {
  high: '#FEE2E2',
  moderate: '#FEF3C7',
  low: '#DCFCE7',
};

export const RISK_TEXT: Record<RiskLevel, string> = {
  high: '#B91C1C',
  moderate: '#92400E',
  low: '#166534',
};

export const RISK_RING: Record<RiskLevel, { border: string; fill: string }> = {
  high: { border: '#FCA5A5', fill: '#FEF2F2' },
  moderate: { border: '#FCD34D', fill: '#FFFBEB' },
  low: { border: '#BEEFD0', fill: '#EDFFF4' },
};

function level(risk: string | undefined): RiskLevel {
  return risk === 'high' || risk === 'moderate' ? risk : 'low';
}

export function riskBg(risk: string | undefined) {
  return RISK_BG[level(risk)];
}

export function riskText(risk: string | undefined) {
  return RISK_TEXT[level(risk)];
}

export function riskRing(risk: string | undefined) {
  return RISK_RING[level(risk)];
}

/**
 * Replaces the previously hardcoded "82/56/23 out of 100" index. That number was
 * not measured and implied a precision the API does not provide. This counts the
 * domains the API actually reported as elevated.
 */
export function elevatedDomains(risks: Record<string, string> | undefined) {
  const values = Object.values(risks ?? {});
  const elevated = values.filter((v) => v === 'high' || v === 'moderate').length;

  return { elevated, total: values.length };
}

/** AQI 0 is a valid "good" reading, so only null/undefined counts as missing. */
export function aqiLevel(aqi: number | null | undefined): string {
  if (aqi === null || aqi === undefined || !Number.isFinite(aqi)) return 'checking';
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy for sensitive groups';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very unhealthy';
  return 'hazardous';
}

/** The AQI label was previously always green, even at hazardous readings. */
export function aqiColour(aqi: number | null | undefined): string {
  if (aqi === null || aqi === undefined || !Number.isFinite(aqi)) return '#7A8496';
  if (aqi <= 50) return '#18A66A';
  if (aqi <= 100) return '#D97706';
  if (aqi <= 150) return '#EA580C';
  return '#B91C1C';
}
