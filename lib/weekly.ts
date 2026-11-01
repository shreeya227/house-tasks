import { query } from "./db";
import { sendToPerson } from "./push";
import { peopleOf, swapsBetween, tasksOf } from "./repo";
import { currentWeekIndex, notificationFor } from "./schedule";
import type { Household } from "./types";

/**
 * Monday morning: tell each person what they have this week.
 * Everyone gets their own line rather than a group blast. Opt out with notify_weekly = false.
 *
 * Exactly once: before sending, the job claims a (household, week, person) row in
 * weekly_notification. If Vercel's best-effort cron fires twice, or the cron and a manual
 * run overlap, the second claim fails and that person is skipped. A claim is made before
 * the send, so a crash mid-send means a missed nudge, never a duplicate.
 */

export interface WeeklyResult {
  householdId: number;
  weekIndex: number;
  sent: number;
  skipped: number;
}

/**
 * @param force send even if this week was already sent, and don't record it.
 *              Used by the admin's "run now" test button.
 */
export async function notifyHousehold(h: Household, force = false): Promise<WeeklyResult> {
  const index = currentWeekIndex(h);
  const [people, tasks, swaps] = await Promise.all([
    peopleOf(h.id),
    tasksOf(h.id),
    swapsBetween(h.id, index, index),
  ]);

  let sent = 0;
  let skipped = 0;
  for (const p of people) {
    if (!p.notifyWeekly) continue;
    const body = notificationFor(p, people, tasks, index, swaps);
    if (!body) continue;

    if (!force) {
      const claimed = await query(
        `insert into weekly_notification (household_id, week_index, person_id)
         values ($1, $2, $3) on conflict do nothing returning id`,
        [h.id, index, p.id]
      );
      if (claimed.length === 0) {
        skipped++;
        continue;
      }
    }
    await sendToPerson(p.id, "Tasks have rotated", body, "/");
    sent++;
  }
  console.info(`Weekly notifications for household ${h.id} week ${index}: sent ${sent}, skipped ${skipped}`);
  return { householdId: h.id, weekIndex: index, sent, skipped };
}
