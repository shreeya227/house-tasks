import { json, requireSession, route } from "@/lib/http";
import { currentWeekIndex, loadWeek } from "@/lib/schedule";

export const GET = route(async (req) => {
  const { household } = await requireSession(req);
  return json(await loadWeek(household, currentWeekIndex(household)));
});
