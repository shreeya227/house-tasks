import { HttpError, json, requireSession, route } from "@/lib/http";
import { pushEnabled, sendToPerson } from "@/lib/push";

/** Send yourself a test push, so you know it works before Monday. */
export const POST = route(async (req) => {
  const { me } = await requireSession(req);
  if (!pushEnabled()) throw new HttpError(503, "Notifications aren't set up on the server yet.");
  const delivered = await sendToPerson(me.id, "House tasks", "Notifications are working.", "/");
  if (delivered === 0) {
    throw new HttpError(404, "No device is registered for you. Tap Enable notifications first.");
  }
  return json({ delivered });
});
