import { query, transaction } from "@/lib/db";
import { badRequest, intParam, json, noContent, notFound, readJson, requireAdmin, route } from "@/lib/http";
import { TASK_COLUMNS, taskInHousehold } from "@/lib/repo";
import type { Task } from "@/lib/types";

const LOADS = ["Heavy", "Medium", "Light"];

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { household } = await requireAdmin(req);
  const id = intParam((await params).id, "task");
  const t = await taskInHousehold(household.id, id);
  if (!t) throw notFound("No such task");

  const body = await readJson<{ name: string; covers: string; loadLevel: string }>(req);
  if (body.loadLevel !== undefined && !LOADS.includes(body.loadLevel)) throw badRequest("Pick Heavy, Medium or Light");

  const rows = await query<Task>(
    `update task set name = $2, covers = $3, load_level = $4 where id = $1 returning ${TASK_COLUMNS}`,
    [
      id,
      body.name?.trim() || t.name,
      typeof body.covers === "string" ? body.covers.trim() : t.covers,
      body.loadLevel ?? t.loadLevel,
    ]
  );
  return json(rows[0]);
});

/**
 * Remove a task. Anyone who owned it goes back into the rotation (the foreign key does
 * that: on delete set null), then sequence numbers are closed up.
 */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const { household } = await requireAdmin(req);
  const id = intParam((await params).id, "task");
  if (!(await taskInHousehold(household.id, id))) throw notFound("No such task");

  await transaction(async (c) => {
    await c.query("delete from task where id = $1", [id]);
    await c.query(
      `update task set sequence_order = r.rn - 1
       from (select id, row_number() over (order by sequence_order, id) as rn
             from task where household_id = $1) r
       where task.id = r.id`,
      [household.id]
    );
  });
  return noContent();
});
