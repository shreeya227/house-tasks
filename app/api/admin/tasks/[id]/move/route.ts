import { transaction } from "@/lib/db";
import { intParam, json, notFound, requireAdmin, route } from "@/lib/http";
import { tasksOf } from "@/lib/repo";

/**
 * Reorder the weekly sequence: ?delta=-1 (earlier) or ?delta=1 (later).
 * Worth keeping heavy work next to light work, and the two bathrooms apart.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { household } = await requireAdmin(req);
  const id = intParam((await params).id, "task");
  const delta = Math.sign(Number(new URL(req.url).searchParams.get("delta")) || 0);

  const list = await tasksOf(household.id);
  const index = list.findIndex((t) => t.id === id);
  if (index < 0) throw notFound("No such task");
  const target = index + delta;

  if (delta !== 0 && target >= 0 && target < list.length) {
    const a = list[index];
    const b = list[target];
    await transaction(async (c) => {
      await c.query("update task set sequence_order = $2 where id = $1", [a.id, b.sequenceOrder]);
      await c.query("update task set sequence_order = $2 where id = $1", [b.id, a.sequenceOrder]);
    });
  }
  return json(await tasksOf(household.id));
});
