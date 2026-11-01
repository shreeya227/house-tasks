import { query, transaction } from "@/lib/db";
import { badRequest, intParam, json, noContent, notFound, readJson, requireAdmin, route } from "@/lib/http";
import { PERSON_COLUMNS, personInHousehold, taskInHousehold } from "@/lib/repo";
import type { Person } from "@/lib/types";

type Body = { name: string; ownedTaskId: number | null; notifyWeekly: boolean; isAdmin: boolean };

/**
 * Update a person. ownedTaskId is replaced on every call, as in the Spring version:
 * sending null (or leaving it out) puts the person back into the rotation.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { household, me } = await requireAdmin(req);
  const id = intParam((await params).id, "person");
  const p = await personInHousehold(household.id, id);
  if (!p) throw notFound("No such person");

  const body = await readJson<Body>(req);
  const name = body.name?.trim() || p.name;
  const notifyWeekly = typeof body.notifyWeekly === "boolean" ? body.notifyWeekly : p.notifyWeekly;
  const isAdmin = typeof body.isAdmin === "boolean" ? body.isAdmin : p.isAdmin;
  if (id === me.id && !isAdmin) throw badRequest("You can't remove your own admin rights");

  let ownedTaskId: number | null = null;
  if (typeof body.ownedTaskId === "number") {
    if (!(await taskInHousehold(household.id, body.ownedTaskId))) throw badRequest("No such task");
    ownedTaskId = body.ownedTaskId;
  }

  const rows = await query<Person>(
    `update person set name = $2, owned_task_id = $3, notify_weekly = $4, is_admin = $5
     where id = $1 returning ${PERSON_COLUMNS}`,
    [id, name, ownedTaskId, notifyWeekly, isAdmin]
  );
  return json(rows[0]);
});

/** Remove a person, then close the gap in positions so the rotation has no holes. */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const { household, me } = await requireAdmin(req);
  const id = intParam((await params).id, "person");
  if (id === me.id) throw badRequest("You can't remove yourself while you're the admin");
  if (!(await personInHousehold(household.id, id))) throw notFound("No such person");

  await transaction(async (c) => {
    await c.query("delete from person where id = $1", [id]);
    await c.query(
      `update person set position = r.rn - 1
       from (select id, row_number() over (order by position, id) as rn
             from person where household_id = $1) r
       where person.id = r.id`,
      [household.id]
    );
  });
  return noContent();
});
