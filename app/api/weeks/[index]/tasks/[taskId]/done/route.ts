import { query } from "@/lib/db";
import { intParam, noContent, notFound, requireSession, route } from "@/lib/http";
import { taskInHousehold } from "@/lib/repo";

type Params = { index: string; taskId: string };

/** Tick a task done for a week. Idempotent: ticking twice is fine. */
export const POST = route<Params>(async (req, { params }) => {
  const { household, me } = await requireSession(req);
  const p = await params;
  const index = intParam(p.index, "week");
  const taskId = intParam(p.taskId, "task");
  if (!(await taskInHousehold(household.id, taskId))) throw notFound("No such task");

  await query(
    `insert into completion (household_id, week_index, task_id, person_id)
     values ($1, $2, $3, $4)
     on conflict (household_id, week_index, task_id) do nothing`,
    [household.id, index, taskId, me.id]
  );
  return noContent();
});

export const DELETE = route<Params>(async (req, { params }) => {
  const { household } = await requireSession(req);
  const p = await params;
  await query(
    "delete from completion where household_id = $1 and week_index = $2 and task_id = $3",
    [household.id, intParam(p.index, "week"), intParam(p.taskId, "task")]
  );
  return noContent();
});
