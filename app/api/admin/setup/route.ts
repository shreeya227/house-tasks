import { json, requireAdmin, route } from "@/lib/http";
import { peopleOf, tasksOf } from "@/lib/repo";
import { cycleLength, restSlots } from "@/lib/rotation";
import type { Setup } from "@/lib/types";

/** Everything the admin screen needs in one call. */
export const GET = route(async (req) => {
  const { household } = await requireAdmin(req);
  const [people, tasks] = await Promise.all([peopleOf(household.id), tasksOf(household.id)]);
  const body: Setup = {
    household,
    people,
    tasks,
    cycleLength: cycleLength(people, tasks),
    restSlots: restSlots(people, tasks),
  };
  return json(body);
});
