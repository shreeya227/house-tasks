import { query } from "@/lib/db";
import { badRequest, intParam, json, readJson, requireAdmin, route } from "@/lib/http";
import { personInHousehold } from "@/lib/repo";

/**
 * Swap two people's whole assignment (task or rest week) for one week.
 * Admin only, matching the UI: a swap changes someone else's week.
 * Doing the same swap again cancels it out, because the rotation applies swaps in order.
 */
export const POST = route<{ index: string }>(async (req, { params }) => {
  const { household } = await requireAdmin(req);
  const index = intParam((await params).index, "week");
  const body = await readJson<{ personAId: number; personBId: number }>(req);
  const a = body.personAId;
  const b = body.personBId;

  if (typeof a !== "number" || typeof b !== "number") throw badRequest("Pick two people");
  if (a === b) throw badRequest("Pick two different people");
  for (const id of [a, b]) {
    if (!(await personInHousehold(household.id, id))) throw badRequest("Unknown person");
  }

  const rows = await query<{ id: number }>(
    `insert into swap (household_id, week_index, person_a_id, person_b_id)
     values ($1, $2, $3, $4) returning id`,
    [household.id, index, a, b]
  );
  return json({ id: rows[0].id }, 201);
});
