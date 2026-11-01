import { intParam, json, requireSession, route } from "@/lib/http";
import { loadWeek } from "@/lib/schedule";

export const GET = route<{ index: string }>(async (req, { params }) => {
  const { household } = await requireSession(req);
  const index = intParam((await params).index, "week");
  return json(await loadWeek(household, index));
});
