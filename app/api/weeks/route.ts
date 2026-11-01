import { badRequest, json, requireSession, route } from "@/lib/http";
import { currentWeekIndex, loadCycleLength, loadWeeks } from "@/lib/schedule";
import type { RotationTable } from "@/lib/types";

/** The table view. Defaults to the next 8 weeks from now; ?from=&count= picks any range. */
export const GET = route(async (req) => {
  const { household } = await requireSession(req);
  const url = new URL(req.url);
  const current = currentWeekIndex(household);

  const fromParam = url.searchParams.get("from");
  const start = fromParam === null || fromParam === "" ? current : Number(fromParam);
  const count = Number(url.searchParams.get("count") ?? 8);
  if (!Number.isInteger(start) || !Number.isInteger(count)) throw badRequest("Bad range");

  const span = Math.min(Math.max(1, count), 104); // two years is plenty
  const [weeks, cycleLength] = await Promise.all([
    loadWeeks(household, start, start + span - 1),
    loadCycleLength(household),
  ]);
  const body: RotationTable = { currentWeek: current, cycleLength, weeks };
  return json(body);
});
