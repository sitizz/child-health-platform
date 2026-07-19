import { registerBackgroundRiskCheck, unregisterBackgroundRiskCheck } from './background';
import {
  cancelDailyRiskReminder,
  ensureNotificationPermission,
  scheduleDailyRiskReminder,
} from './notifications';

/**
 * Single entry point for turning environmental alerts on or off, so the consent
 * flow, the home screen, and the settings screen cannot drift. Opting out
 * cancels the daily reminder and the background task; opting in requires OS
 * permission first and is a no-op (returning false) if it is refused.
 *
 * Returns whether alerts are actually active afterwards.
 */
export async function applyAlertPreference(
  optIn: boolean,
  childName?: string
): Promise<boolean> {
  if (!optIn) {
    await cancelDailyRiskReminder();
    await unregisterBackgroundRiskCheck();
    return false;
  }

  const granted = await ensureNotificationPermission();

  if (!granted) {
    await cancelDailyRiskReminder();
    await unregisterBackgroundRiskCheck();
    return false;
  }

  await scheduleDailyRiskReminder(childName);
  await registerBackgroundRiskCheck();

  return true;
}
