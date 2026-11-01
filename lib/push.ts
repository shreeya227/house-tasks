import webpush from "web-push";
import { query } from "./db";

/**
 * Sends Web Push messages. The same code reaches iPhones (through Apple's push service),
 * Android and desktop browsers: the browser gives you an endpoint, you post to it.
 *
 * Push is optional: without VAPID keys the rest of the app still runs and only
 * notifications are disabled.
 */

let configured: boolean | null = null;

export function pushEnabled(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn(
      "VAPID keys are not set, so notifications are disabled. " +
        "Generate a pair with 'npm run vapid' and set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY."
    );
    return (configured = false);
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:you@example.com",
      publicKey,
      privateKey
    );
    return (configured = true);
  } catch (e) {
    console.error("VAPID keys were rejected, so notifications are disabled:", (e as Error).message);
    return (configured = false);
  }
}

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends to every device this person has registered. Returns how many accepted it. */
export async function sendToPerson(
  personId: number,
  title: string,
  body: string,
  url = "/"
): Promise<number> {
  if (!pushEnabled()) return 0;
  const subs = await query<SubRow>(
    `select id, endpoint, p256dh_key as p256dh, auth_key as auth
     from push_subscription where person_id = $1`,
    [personId]
  );
  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24 } // a phone that's off until evening still gets it
        );
        return true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser threw the subscription away. Stop trying.
          console.info(`Pruning expired push subscription ${s.id}`);
          await query("delete from push_subscription where id = $1", [s.id]);
        } else {
          console.warn(`Push to subscription ${s.id} failed (${status ?? "no status"}):`, (e as Error).message);
        }
        return false;
      }
    })
  );
  return results.filter(Boolean).length;
}
