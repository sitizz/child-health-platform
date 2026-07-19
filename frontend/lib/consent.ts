import AsyncStorage from '@react-native-async-storage/async-storage';

const CONSENT_KEY = 'pilotConsent';

/**
 * Bump when the consent text materially changes. A stored record on an older
 * version is treated as "needs re-consent" so the gate can re-present the notice.
 */
export const CONSENT_VERSION = 'cg-health-consent-v1';

export type ConsentConfirmations = {
  guardian: boolean;
  read: boolean;
  notMedical: boolean;
  dataProcessing: boolean;
  location: boolean;
};

/**
 * The five confirmations that are mandatory to grant consent. Notifications are
 * intentionally excluded — the spec marks that consent as optional.
 */
export const REQUIRED_CONFIRMATIONS: (keyof ConsentConfirmations)[] = [
  'guardian',
  'read',
  'notMedical',
  'dataProcessing',
  'location',
];

export type ConsentStatus = 'granted' | 'declined';

export type ConsentRecord = {
  status: ConsentStatus;
  version: string;
  accepted_at: string | null;
  updated_at: string | null;
  confirmations: ConsentConfirmations;
  notificationsOptIn: boolean;
};

const EMPTY_CONFIRMATIONS: ConsentConfirmations = {
  guardian: false,
  read: false,
  notMedical: false,
  dataProcessing: false,
  location: false,
};

const ALL_CONFIRMATIONS: ConsentConfirmations = {
  guardian: true,
  read: true,
  notMedical: true,
  dataProcessing: true,
  location: true,
};

/**
 * Reads the consent record, migrating the pre-existing shape
 * (`{ accepted, accepted_at, version }`) so users who already consented under
 * the old flow are not forced back through it.
 */
export async function loadConsent(): Promise<ConsentRecord | null> {
  const raw = await AsyncStorage.getItem(CONSENT_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed.status === 'string') {
      return parsed as ConsentRecord;
    }

    // Legacy record from the original single-checkbox consent screen.
    if (parsed?.accepted) {
      return {
        status: 'granted',
        version: parsed.version ?? 'legacy',
        accepted_at: parsed.accepted_at ?? null,
        updated_at: parsed.accepted_at ?? null,
        confirmations: ALL_CONFIRMATIONS,
        notificationsOptIn: true,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function saveConsentGranted(
  confirmations: ConsentConfirmations,
  notificationsOptIn: boolean
): Promise<ConsentRecord> {
  const now = new Date().toISOString();

  const record: ConsentRecord = {
    status: 'granted',
    version: CONSENT_VERSION,
    accepted_at: now,
    updated_at: now,
    confirmations,
    notificationsOptIn,
  };

  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(record));

  return record;
}

/**
 * Records a decline while keeping the record present, so the home gate routes
 * the user into limited mode instead of looping back to the consent screen.
 */
export async function saveConsentDeclined(): Promise<ConsentRecord> {
  const now = new Date().toISOString();

  const existing = await loadConsent();

  const record: ConsentRecord = {
    status: 'declined',
    version: CONSENT_VERSION,
    accepted_at: existing?.accepted_at ?? null,
    updated_at: now,
    confirmations: existing?.confirmations ?? EMPTY_CONFIRMATIONS,
    notificationsOptIn: false,
  };

  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(record));

  return record;
}

/** Withdrawing later is equivalent to declining: personalised access is revoked. */
export async function withdrawConsent(): Promise<ConsentRecord> {
  return saveConsentDeclined();
}

export async function setNotificationsOptIn(value: boolean): Promise<ConsentRecord | null> {
  const existing = await loadConsent();

  if (!existing) return null;

  const record: ConsentRecord = {
    ...existing,
    notificationsOptIn: value,
    updated_at: new Date().toISOString(),
  };

  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(record));

  return record;
}

export function hasPersonalisedAccess(consent: ConsentRecord | null): boolean {
  return consent?.status === 'granted' && consent.version === CONSENT_VERSION;
}

export function allRequiredConfirmed(confirmations: ConsentConfirmations): boolean {
  return REQUIRED_CONFIRMATIONS.every((key) => confirmations[key]);
}

export { EMPTY_CONFIRMATIONS };
