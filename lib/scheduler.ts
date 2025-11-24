import cron, { type ScheduledTask } from 'node-cron';
import { getEnabledSchedules, getSettings, addLog } from './db';
import { changePlan } from './services/plan-changer';

let isInitialized = false;
let scheduledTasks: Map<number, ScheduledTask> = new Map();

/**
 * Initialize the scheduler
 * This should be called once when the app starts
 */
export function initScheduler() {
  if (isInitialized) {
    console.log('[Scheduler] Already initialized');
    return;
  }

  console.log('[Scheduler] Initializing...');

  // Check every minute for scheduled tasks
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    console.log(`[Scheduler] Running check at ${now.toISOString()}`);

    try {
      const schedules = getEnabledSchedules();
      const settings = getSettings();

      if (!settings) {
        console.log('[Scheduler] No settings configured, skipping scheduled tasks');
        return;
      }

      for (const schedule of schedules) {
        // Convert current time to schedule's timezone
        const scheduleTimezone = schedule.timezone || 'UTC';
        const nowInScheduleTimezone = new Date(now.toLocaleString('en-US', { timeZone: scheduleTimezone }));
        const currentHour = nowInScheduleTimezone.getHours();
        const currentMinute = nowInScheduleTimezone.getMinutes();

        console.log(`[Scheduler] Checking schedule ${schedule.id} in ${scheduleTimezone}: ${currentHour}:${currentMinute.toString().padStart(2, '0')} vs ${schedule.hour}:${schedule.minute.toString().padStart(2, '0')}`);

        if (schedule.hour === currentHour && schedule.minute === currentMinute) {
          console.log(`[Scheduler] Executing scheduled plan change: ${schedule.planName} (PSID: ${schedule.psid}) in ${scheduleTimezone}`);

          try {
            const result = await changePlan({
              base: settings.base,
              username: settings.username,
              password: settings.password,
              userId: settings.userId,
              serviceId: settings.serviceId,
              avcId: settings.avcId,
              locId: settings.locId,
              discountCode: settings.discountCode,
              unpause: settings.unpause,
              coat: settings.coat,
              churn: settings.churn,
              scheduledDt: settings.scheduledDt,
              newServicePaymentOption: settings.newServicePaymentOption,
              timeoutMs: settings.timeoutMs,
              psid: schedule.psid,
            });

            addLog({
              success: result.success,
              message: `Scheduled (${scheduleTimezone}): ${result.message}`,
              planName: result.planName,
              psid: result.psid,
              timestamp: result.timestamp,
            });

            console.log(`[Scheduler] Result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Scheduler] Error executing scheduled task:`, errorMessage);

            addLog({
              success: false,
              message: `Scheduled task failed (${scheduleTimezone}): ${errorMessage}`,
              planName: schedule.planName,
              psid: schedule.psid,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error checking scheduled tasks:', error);
    }
  });

  isInitialized = true;
  console.log('[Scheduler] Initialized successfully');
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks.clear();
  isInitialized = false;
  console.log('[Scheduler] Stopped');
}
