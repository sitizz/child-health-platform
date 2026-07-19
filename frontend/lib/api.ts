const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://child-health-platform.onrender.com';

const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

// Render free tier cold-starts can exceed 50s.
const REQUEST_TIMEOUT_MS = 60000;

export type RiskLevel = 'low' | 'moderate' | 'high';

export type ChildProfile = {
  id: string;
  name: string;
  age: number;
  age_group: 'under5' | 'child' | 'adolescent';
  asthma: boolean;
  fever: boolean;
  cough: boolean;
  dehydration: boolean;
  mosquito_exposure: boolean;
  flood_exposure: boolean;
};

export type EnvironmentRisk = {
  environment: {
    temperature: number;
    humidity: number;
    rainfall: number;
    aqi: number | null;
    pm2_5: number;
    pm10: number;
  };
  risks: Record<'heat_stress' | 'respiratory' | 'dengue' | 'flood', RiskLevel>;
  risk_reasons: Partial<Record<'heat_stress' | 'respiratory' | 'dengue' | 'flood', string[]>>;
  child_vulnerability: { level: RiskLevel; reasons: string[] };
  predictive_domains: Record<'heat_stress' | 'respiratory' | 'dengue', RiskLevel>;
  priority_alert: RiskLevel;
  forecast: {
    day: number;
    max_temperature: number;
    rainfall: number;
    predicted_risk: RiskLevel;
  }[];
  action: string;
  recommended_action: {
    immediate?: string[];
    caregiver?: string[];
    school?: string[];
    community?: string[];
    when_to_escalate?: string[];
  };
  trend: { direction: string; message: string };
  escalation: { level: string; reason: string };
  guidance: { group: string; summary: string; key_points?: string[] };
};

/**
 * Carries a caregiver-facing message. Screens show `message` directly rather
 * than guessing at a cause — a 401 must never surface as "complete your profile".
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function messageForStatus(status: number): string {
  if (status === 401) {
    return 'The app could not authenticate with the risk service. Please contact support.';
  }
  if (status === 422) {
    return 'This child profile is incomplete or invalid. Please review the profile details.';
  }
  if (status === 429) {
    return 'Too many risk checks in a short time. Please wait a moment and try again.';
  }
  if (status === 503) {
    return 'Environmental data is temporarily unavailable. Please try again shortly.';
  }
  return 'Unable to reach the risk service. Please check your connection and try again.';
}

/**
 * The API rejects `age_group=undefined` with a 422, so profiles are validated
 * before a request is spent on them.
 */
function assertUsableProfile(
  child: ChildProfile | null | undefined
): asserts child is ChildProfile {
  const valid = ['under5', 'child', 'adolescent'];

  if (!child || !valid.includes(child.age_group)) {
    throw new ApiError(
      422,
      'This child profile is incomplete. Please update the age and try again.'
    );
  }
}

export async function fetchEnvironmentRisk(
  child: ChildProfile | null | undefined,
  lat: number,
  lon: number
): Promise<EnvironmentRisk> {
  assertUsableProfile(child);

  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    age_group: child.age_group,
    ...childFlagStrings(child),
  });

  const response = await fetchWithTimeout(
    `${API_URL}/api/v1/environment-risk?${query.toString()}`,
    { headers: { 'X-API-Key': API_KEY } }
  );

  if (!response.ok) {
    throw new ApiError(response.status, messageForStatus(response.status));
  }

  const data = await response.json();

  // A 200 that is missing the fields every screen indexes into would crash the
  // UI further down, so it is rejected here instead.
  if (!data?.priority_alert || !data?.risks || !data?.environment) {
    throw new ApiError(502, 'The risk service returned an unexpected response. Please try again.');
  }

  return data as EnvironmentRisk;
}

export type BatchPoint = { id: string; lat: number; lon: number };

export type BatchResultItem = {
  id: string | null;
  result: EnvironmentRisk | null;
  error: string | null;
};

/**
 * One request for many locations, instead of one GET per point. This is what the
 * regional map uses: five parallel GETs were the single largest source of
 * upstream weather-API rate-limiting. The batch endpoint also degrades per item
 * (HTTP 200 with `error` set on failed points) rather than failing the whole map.
 */
export async function fetchEnvironmentRiskBatch(
  child: ChildProfile | null | undefined,
  points: BatchPoint[]
): Promise<BatchResultItem[]> {
  assertUsableProfile(child);

  const response = await fetchWithTimeout(`${API_URL}/api/v1/environment-risk/batch`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: points.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon })),
      age_group: child.age_group,
      asthma: !!child.asthma,
      fever: !!child.fever,
      cough: !!child.cough,
      dehydration: !!child.dehydration,
      mosquito_exposure: !!child.mosquito_exposure,
      flood_exposure: !!child.flood_exposure,
    }),
  });

  if (!response.ok) {
    throw new ApiError(response.status, messageForStatus(response.status));
  }

  const data = await response.json();

  if (!Array.isArray(data?.results)) {
    throw new ApiError(502, 'The risk service returned an unexpected response. Please try again.');
  }

  return data.results as BatchResultItem[];
}

function childFlagStrings(child: ChildProfile): Record<string, string> {
  return {
    asthma: String(!!child.asthma),
    fever: String(!!child.fever),
    cough: String(!!child.cough),
    dehydration: String(!!child.dehydration),
    mosquito_exposure: String(!!child.mosquito_exposure),
    flood_exposure: String(!!child.flood_exposure),
  };
}

/**
 * Shared fetch wrapper enforcing the request timeout and translating network /
 * abort failures into ApiError, so both the single and batch calls report
 * failures the same way.
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'The risk service took too long to respond. Please try again.');
    }
    throw new ApiError(0, messageForStatus(0));
  } finally {
    clearTimeout(timeout);
  }
}

export { API_KEY, API_URL };
