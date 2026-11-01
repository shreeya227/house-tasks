import { json, requireAdmin, route } from "@/lib/http";
import { notifyHousehold } from "@/lib/weekly";

/**
 * Fire the Monday message now, for testing. Admin only (it was open to everyone in the
 * Spring version). Sends even if this week already went out, and doesn't count as the
 * real send, so the Monday cron still runs normally.
 */
export const POST = route(async (req) => {
  const { household } = await requireAdmin(req);
  return json(await notifyHousehold(household, true));
});
