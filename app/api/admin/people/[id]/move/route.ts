import { transaction } from "@/lib/db";
import { intParam, json, notFound, requireAdmin, route } from "@/lib/http";
import { peopleOf } from "@/lib/repo";

/** Move a person up or down the rotation order: ?delta=-1 or ?delta=1. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { household } = await requireAdmin(req);
  const id = intParam((await params).id, "person");
  const delta = Math.sign(Number(new URL(req.url).searchParams.get("delta")) || 0);

  const list = await peopleOf(household.id);
  const index = list.findIndex((p) => p.id === id);
  if (index < 0) throw notFound("No such person");
  const target = index + delta;

  if (delta !== 0 && target >= 0 && target < list.length) {
    const a = list[index];
    const b = list[target];
    await transaction(async (c) => {
      await c.query("update person set position = $2 where id = $1", [a.id, b.position]);
      await c.query("update person set position = $2 where id = $1", [b.id, a.position]);
    });
  }
  return json(await peopleOf(household.id));
});
