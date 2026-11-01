import { json, requireSession, route } from "@/lib/http";
import { loadStats } from "@/lib/schedule";

export const GET = route(async (req) => {
  const { household } = await requireSession(req);
  const weeks = Number(new URL(req.url).searchParams.get("weeks") ?? 8);
  return json(await loadStats(household, Number.isInteger(weeks) ? weeks : 8));
});
