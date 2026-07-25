import { router } from 'expo-router';

import { getAccessToken, isSessionExpired, needsConsent, needsDisclaimer } from './api-client';
import { fetchMe } from './auth-api';
import { listChildren } from './children-api';
import { getConsentStatus, getDisclaimerStatus } from './server-consent';

export type StartRoute = '/login' | '/consent' | '/disclaimer' | '/profile-setup' | '/';

/**
 * Decides where the app should land on launch by walking the server-side gates:
 * authenticated → consent accepted → disclaimer acknowledged → has a child.
 * Any failure resolves to the earliest unmet step.
 */
export async function resolveStartRoute(): Promise<StartRoute> {
  const token = await getAccessToken();
  if (!token) return '/login';

  try {
    await fetchMe();
  } catch {
    // Refresh already attempted inside the client; a failure here means no valid session.
    return '/login';
  }

  try {
    const consent = await getConsentStatus();
    if (!consent.accepted) return '/consent';

    const disclaimer = await getDisclaimerStatus();
    if (!disclaimer.acknowledged) return '/disclaimer';

    const children = await listChildren();
    if (!children.length) return '/profile-setup';

    return '/';
  } catch (err) {
    if (needsConsent(err)) return '/consent';
    if (needsDisclaimer(err)) return '/disclaimer';
    if (isSessionExpired(err)) return '/login';
    // Transient server error: let the caller keep the user where they are.
    throw err;
  }
}

/**
 * Routes to the correct screen when any personalised call fails on a gate or an
 * expired session. Returns true if it handled (and navigated for) the error.
 */
export function routeForGateError(err: unknown): boolean {
  if (needsConsent(err)) {
    router.replace('/consent');
    return true;
  }
  if (needsDisclaimer(err)) {
    router.replace('/disclaimer');
    return true;
  }
  if (isSessionExpired(err)) {
    router.replace('/login');
    return true;
  }
  return false;
}
