import { query } from "@/lib/db";
import { intParam, noContent, requireAdmin, route } from "@/lib/http";

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const { household } = await requireAdmin(req);
  await query("delete from swap where id = $1 and household_id = $2", [
    intParam((await params).id, "swap"),
    household.id,
  ]);
  return noContent();
});
