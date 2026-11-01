import { query } from "@/lib/db";
import { json, readJson, requireAdmin, route } from "@/lib/http";
import { TASK_COLUMNS } from "@/lib/repo";
import type { Task } from "@/lib/types";

const LOADS = ["Heavy", "Medium", "Light"];

/** Add a task at the end of the weekly sequence. */
export const POST = route(async (req) => {
  const { household } = await requireAdmin(req);
  const body = await readJson<{ name: string; covers: string; loadLevel: string }>(req);
  const name = body.name?.trim() || "New task";
  const covers = body.covers?.trim() ?? "";
  const loadLevel = body.loadLevel && LOADS.includes(body.loadLevel) ? body.loadLevel : "Medium";

  const rows = await query<Task>(
    `insert into task (household_id, name, covers, load_level, sequence_order)
     values ($1, $2, $3, $4,
       (select coalesce(max(sequence_order) + 1, 0) from task where household_id = $1))
     returning ${TASK_COLUMNS}`,
    [household.id, name, covers, loadLevel]
  );
  return json(rows[0]);
});
