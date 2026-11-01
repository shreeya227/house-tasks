import { query } from "@/lib/db";
import { badRequest, json, readJson, requireAdmin, route } from "@/lib/http";
import { PERSON_COLUMNS, taskInHousehold } from "@/lib/repo";
import type { Person } from "@/lib/types";

/** Add a housemate at the end of the rotation order. */
export const POST = route(async (req) => {
  const { household } = await requireAdmin(req);
  const body = await readJson<{ name: string; ownedTaskId: number | null; notifyWeekly: boolean }>(req);
  const name = body.name?.trim();
  if (!name) throw badRequest("A name is required");

  let ownedTaskId: number | null = null;
  if (typeof body.ownedTaskId === "number") {
    if (!(await taskInHousehold(household.id, body.ownedTaskId))) throw badRequest("No such task");
    ownedTaskId = body.ownedTaskId;
  }

  const rows = await query<Person>(
    `insert into person (household_id, name, position, owned_task_id, notify_weekly)
     values ($1, $2,
       (select coalesce(max(position) + 1, 0) from person where household_id = $1),
       $3, $4)
     returning ${PERSON_COLUMNS}`,
    [household.id, name, ownedTaskId, body.notifyWeekly ?? true]
  );
  return json(rows[0]);
});
