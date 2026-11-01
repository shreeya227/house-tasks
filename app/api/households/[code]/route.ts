import { json, notFound, route } from "@/lib/http";
import { householdByCode, peopleOf } from "@/lib/repo";
import type { HouseholdSummary } from "@/lib/types";

/** Open the join link, see who lives here, and pick your name. */
export const GET = route<{ code: string }>(async (_req, { params }) => {
  const { code } = await params;
  const h = await householdByCode(code);
  if (!h) throw notFound("No such house");
  const people = await peopleOf(h.id);
  const body: HouseholdSummary = {
    name: h.name,
    joinCode: h.joinCode,
    people: people.map((p) => ({ id: p.id, name: p.name, notifyWeekly: p.notifyWeekly })),
  };
  return json(body);
});
