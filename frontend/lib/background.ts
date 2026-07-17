import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { runRiskCheck } from './risk-check';

export const BACKGROUND_RISK_TASK = 'child-guard-background-risk-check';

/**
 * Must be defined at module scope, not inside a component: the OS relaunches the
 * app into a fresh JS context to run this, and the task must already be
 * registered by the time that context finishes evaluating.
 */
TaskManager.defineTask(BACKGROUND_RISK_TASK, async () => {
  try {
    const { data, error } = await runRiskCheck({ background: true });

    // runRiskCheck fires any high-risk / improvement notification itself, so
    // there is nothing to do here but report the outcome to the scheduler.
    if (!data) {
      console.warn('[background] risk check produced no data:', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    console.error('[background] risk check threw:', err);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * The OS treats the interval as a lower bound and coalesces wakeups to save
 * battery; iOS in particular often defers to overnight windows. Registration is
 * idempotent, so calling this on every launch is safe.
 */
export async function registerBackgroundRiskCheck(): Promise<BackgroundTask.BackgroundTaskStatus | null> {
  // Web and the iOS Simulator both report Restricted, and registerTaskAsync
  // throws outright on web (its module has no such method). Background support
  // is optional, so nothing here may propagate and abort app start-up.
  try {
    const status = await BackgroundTask.getStatusAsync();

    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.warn('[background] tasks are restricted here; skipping registration.');
      return status;
    }

    if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_RISK_TASK))) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_RISK_TASK, {
        minimumInterval: 60,
      });
    }

    return status;
  } catch (err) {
    console.warn('[background] registration unavailable on this platform:', err);
    return null;
  }
}

export async function unregisterBackgroundRiskCheck() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_RISK_TASK)) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_RISK_TASK);
    }
  } catch (err) {
    console.warn('[background] unregister unavailable on this platform:', err);
  }
}
