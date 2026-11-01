import { query } from "@/lib/db";
import { badRequest, noContent, readJson, requireSession, route } from "@/lib/http";

/** Store this device's push subscription. Re-subscribing the same device just updates it. */
export const POST = route(async (req) => {
  const { me } = await requireSession(req);
  const body = await readJson<{ endpoint: string; p256dh: string; auth: string }>(req);
  if (!body.endpoint || !body.p256dh || !body.auth) throw badRequest("Incomplete subscription");
  if (!body.endpoint.startsWith("https://")) throw badRequest("Bad push endpoint");

  await query(
    `insert into push_subscription (person_id, endpoint, p256dh_key, auth_key)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update
       set person_id = excluded.person_id,
           p256dh_key = excluded.p256dh_key,
           auth_key = excluded.auth_key`,
    [me.id, body.endpoint, body.p256dh, body.auth]
  );
  return noContent();
});

/** Forget a device: only your own subscriptions. */
export const DELETE = route(async (req) => {
  const { me } = await requireSession(req);
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  if (!endpoint) throw badRequest("Which device?");
  await query("delete from push_subscription where endpoint = $1 and person_id = $2", [endpoint, me.id]);
  return noContent();
});
